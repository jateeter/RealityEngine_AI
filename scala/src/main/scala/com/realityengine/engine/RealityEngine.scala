package com.realityengine.engine

import akka.actor.{ActorRef, ActorSystem}
import akka.pattern.ask
import akka.util.Timeout
import com.realityengine.actors.MachineActor
import com.realityengine.models._
import com.realityengine.services.VectorStore
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import io.circe.Json

case class MachineCheckpoint(
  id:          String,
  machineId:   String,
  machineName: String,
  label:       Option[String],
  timestamp:   Long,
  snapshot:    Machine
)

/**
 * RealityEngine — core processing engine for Reality Vectors.
 *
 * Responsibilities:
 *  - Manage Machines and CriticalEventSequences
 *  - Route inputs through the 3-phase Reality Engine workflow
 *  - Coordinate PreceptionEngine (universal input resolution)
 *  - Checkpoint / what-if analytic workflows
 *  - Interface with VectorStore for persistence
 *
 * RC-1 fix: each Machine is owned by a MachineActor whose mailbox serialises
 * all processInput calls, eliminating the shared-mutable-buffer race condition.
 * Machines that belong to different actors process in parallel via Future.sequence.
 */
class RealityEngine(
  val vectorStore:        VectorStore,
  val maxHistorySize:     Int     = 1000,
  val universalDimension: Int     = 256,
  val verboseLogging:     Boolean = false
)(implicit system: ActorSystem, ec: ExecutionContext) {

  import RealityEngine.askTimeout

  private var sequences:    Map[String, CriticalEventSequence] = Map.empty
  private var machines:     Map[String, Machine]               = Map.empty
  private var machineActors: Map[String, ActorRef]             = Map.empty
  private var checkpoints:  Map[String, Map[String, MachineCheckpoint]] = Map.empty

  // Circular buffer: newest at index 0, oldest at the tail.
  private val transitionHistory: scala.collection.mutable.ArrayDeque[TransitionResult] =
    scala.collection.mutable.ArrayDeque.empty

  val preceptionEngine = new PreceptionEngine(universalDimension)

  // ── Initialization ────────────────────────────────────────────────────────

  def initialize()(implicit ec: ExecutionContext): Future[Unit] =
    vectorStore.initialize().map { _ =>
      println("RealityEngine initialized")
    }

  // ── Sequence management ───────────────────────────────────────────────────

  def addSequence(seq: CriticalEventSequence): Unit = {
    val (valid, errors) = seq.validate()
    require(valid, s"Invalid sequence: ${errors.mkString(", ")}")
    sequences = sequences + (seq.id -> seq)
    println(s"Added sequence: ${seq.name} (${seq.id})")
  }

  def removeSequence(sequenceId: String): Unit = { sequences = sequences - sequenceId }
  def getSequence(id: String): Option[CriticalEventSequence] = sequences.get(id)
  def getAllSequences: List[CriticalEventSequence] = sequences.values.toList

  // ── Machine management ────────────────────────────────────────────────────

  def addMachine(machine: Machine): Unit = {
    val actor = system.actorOf(MachineActor.props(machine))
    machines      = machines      + (machine.id -> machine)
    machineActors = machineActors + (machine.id -> actor)
    machine.getAllSequences.foreach(addSequence)
    println(s"Added machine: ${machine.name} (${machine.id}) with ${machine.getSequenceCount} sequences")
  }

  def removeMachine(machineId: String): Boolean = {
    machines.get(machineId) match {
      case None => false
      case Some(machine) =>
        machine.getSequenceIds.foreach(removeSequence)
        machineActors.get(machineId).foreach(system.stop)
        machines      = machines      - machineId
        machineActors = machineActors - machineId
        true
    }
  }

  def getMachine(id: String): Option[Machine]  = machines.get(id)
  def getAllMachines: List[Machine]             = machines.values.toList

  // ── Processing ────────────────────────────────────────────────────────────

  /**
   * Process a machine-dimension input vector through a specific machine via
   * the PreceptionEngine.
   */
  def processMachineInput(machineId: String, inputVector: Vector[Double]): Future[MachineTransitionResult] = {
    machines.get(machineId) match {
      case None => Future.failed(new NoSuchElementException(s"Machine not found: $machineId"))
      case Some(machine) =>
        machine.perceptualMapping match {
          case None => Future.failed(new IllegalStateException(
            s"""Machine "${machine.name}" has no perceptual mapping — configure one or use /process-universal."""))
          case Some(mapping) =>
            if (inputVector.length != mapping.input.length)
              Future.failed(new IllegalArgumentException(
                s"Input vector length ${inputVector.length} does not match machine input region length ${mapping.input.length}"))
            else {
              val universalSpace = Vector.fill(universalDimension)(0.0)
                .patch(mapping.input.offset, inputVector, inputVector.length)
              processUniversalInput(universalSpace, machineId)
            }
        }
    }
  }

  /**
   * Process a full universal input space through one specific machine.
   * Routes through the machine's actor mailbox for per-machine atomicity.
   */
  def processUniversalInput(universalInputSpace: Vector[Double], machineId: String): Future[MachineTransitionResult] = {
    machines.get(machineId) match {
      case None => Future.failed(new NoSuchElementException(s"Machine not found: $machineId"))
      case Some(machine) =>
        val actor       = machineActors(machineId)
        val machineInput = preceptionEngine.resolveInputEventVectorForMachine(universalInputSpace, machine)

        val tagMachineId   = Json.fromString(machineId)
        val tagMachineName = Json.fromString(machine.name)
        val tagDim         = Json.fromInt(universalInputSpace.length)
        val hasMerge       = machine.perceptualMapping.isDefined

        (actor ? MachineActor.ProcessInput(machineInput)).mapTo[MachineActor.ProcessInputResult].map { pr =>
          val result = pr.result

          if (verboseLogging)
            println(s"[RealityEngine] machine=${machine.name} id=$machineId " +
              s"sequencesWithOutput=${result.arbiterMetadata.sequencesWithOutput} " +
              s"shouldOutput=${result.arbiterMetadata.shouldOutput} ts=${result.timestamp}")

          machine.perceptualMapping.foreach { mapping =>
            if (result.arbiterMetadata.shouldOutput) {
              result.sequenceResults.values.foreach { sr =>
                sr.assertedOutputs.foreach { ao =>
                  preceptionEngine.mergeOutputIntoPerceptualSpace(ao.vector, mapping)
                }
              }
            }
          }

          val tagMerged = Json.fromBoolean(result.arbiterMetadata.shouldOutput && hasMerge)
          result.copy(machineOutput = result.machineOutput.map { ov =>
            ov.copy(metadata = ov.metadata ++
              Map("machineId"                     -> tagMachineId,
                  "machineName"                   -> tagMachineName,
                  "preceptionUsed"                -> RealityEngine.JsonTrue,
                  "universalSpaceDimension"       -> tagDim,
                  "outputMergedToPerceptualSpace" -> tagMerged))
          })
        }
    }
  }

  /**
   * Process universal input through ALL machines in parallel across actors.
   *
   * Phase 1: snapshot all machine inputs (sequential, prevents read-your-own-write
   *          within a single cycle).
   * Phase 2: dispatch ProcessInput to every machine actor simultaneously; each
   *          actor's FIFO mailbox serialises intra-machine calls.
   * Phase 3: after all Futures resolve, merge outputs into perceptual space
   *          (sequential — preserves deterministic merge order within a cycle).
   */
  def processUniversalInputForAllMachines(universalInputSpace: Vector[Double]): Future[Map[String, MachineTransitionResult]] = {
    val resolvedInputs = preceptionEngine.resolveInputsForMachines(universalInputSpace, machines)
    val tagDim         = Json.fromInt(universalInputSpace.length)

    val askFutures: Iterable[Future[(Machine, String, MachineTransitionResult)]] =
      machines.flatMap { case (machineId, machine) =>
        for {
          machineInput <- resolvedInputs.get(machineId)
          actor        <- machineActors.get(machineId)
        } yield {
          val tagMachineId   = Json.fromString(machineId)
          val tagMachineName = Json.fromString(machine.name)

          (actor ? MachineActor.ProcessInput(machineInput)).mapTo[MachineActor.ProcessInputResult].map { pr =>
            val tagged = pr.result.copy(machineOutput = pr.result.machineOutput.map { ov =>
              ov.copy(metadata = ov.metadata ++
                Map("machineId"               -> tagMachineId,
                    "machineName"             -> tagMachineName,
                    "preceptionUsed"          -> RealityEngine.JsonTrue,
                    "universalSpaceDimension" -> tagDim))
            })
            (machine, machineId, tagged)
          }.recover { case e: Exception =>
            System.err.println(s"Error processing machine $machineId: ${e.getMessage}")
            throw e
          }
        }
      }

    Future.sequence(askFutures).map { triples =>
      // Phase 3: merge all outputs — sequential within this callback.
      for ((machine, machineId, result) <- triples if result.arbiterMetadata.shouldOutput) {
        machine.perceptualMapping.foreach { mapping =>
          result.sequenceResults.valuesIterator.flatMap(_.assertedOutputs).foreach { ao =>
            try preceptionEngine.mergeOutputIntoPerceptualSpace(ao.vector, mapping)
            catch { case e: Exception =>
              System.err.println(s"Failed to merge output for machine $machineId: ${e.getMessage}")
            }
          }
        }
      }
      triples.map { case (_, machineId, result) => machineId -> result }.toMap
    }
  }

  def getDiagnosticMapping(universalInputSpace: Vector[Double]): io.circe.Json =
    preceptionEngine.getDiagnosticMapping(universalInputSpace, machines)

  // ── What-if ───────────────────────────────────────────────────────────────

  // What-if operations clone the machine and call processInput on the clone —
  // no actor routing needed since the clone is a throwaway private copy.
  // Note: the clone reflects machine definition state (sequences, vectors) but
  // not live actor-owned runtime state (active vector pointers). This is an
  // accepted approximation for the starting-point implementation.

  def processWhatIf(machineId: String, inputVector: Vector[Double]): MachineTransitionResult = {
    val machine = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    machine.clone().processInput(inputVector)
  }

  def processUniversalWhatIf(universalInputSpace: Vector[Double], machineId: String): MachineTransitionResult = {
    val machine      = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    val machineInput = preceptionEngine.resolveInputEventVectorForMachine(universalInputSpace, machine)
    machine.clone().processInput(machineInput)
  }

  // ── Checkpoints ───────────────────────────────────────────────────────────

  // Checkpoint snapshots are taken from the machine definition in the `machines`
  // map. In the starting-point implementation this is the same Machine instance
  // the actor holds (shared reference). For full correctness the actor should be
  // asked for a live snapshot via GetSnapshot; that is a follow-on step.

  def createCheckpoint(machineId: String, label: Option[String] = None): String = {
    val machine = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    val cpId    = s"cp-${System.currentTimeMillis()}-${java.util.UUID.randomUUID().toString.take(9)}"
    val cp      = MachineCheckpoint(cpId, machineId, machine.name, label, System.currentTimeMillis(), machine.clone())
    val bucket  = checkpoints.getOrElse(machineId, Map.empty)
    checkpoints = checkpoints + (machineId -> (bucket + (cpId -> cp)))
    cpId
  }

  def listCheckpoints(machineId: String): List[MachineCheckpoint] =
    checkpoints.getOrElse(machineId, Map.empty).values.toList

  def restoreCheckpoint(machineId: String, checkpointId: String): Unit = {
    val cp = checkpoints.get(machineId).flatMap(_.get(checkpointId))
      .getOrElse(throw new NoSuchElementException(s"Checkpoint $checkpointId not found for machine $machineId"))
    removeMachine(machineId)
    addMachine(cp.snapshot.clone())
  }

  def deleteCheckpoint(machineId: String, checkpointId: String): Boolean = {
    checkpoints.get(machineId) match {
      case None => false
      case Some(bucket) =>
        if (bucket.contains(checkpointId)) {
          checkpoints = checkpoints + (machineId -> (bucket - checkpointId))
          true
        } else false
    }
  }

  // ── Legacy sequence-level processing ─────────────────────────────────────

  def processInputLegacy(inputVector: Vector[Double]): TransitionResult = {
    val outputs = sequences.flatMap { case (seqId, seq) =>
      val sr = seq.transition(inputVector)
      sr.assertedOutputs.map(o =>
        o.copy(metadata = o.metadata ++
          Map("sequenceId"   -> Json.fromString(seqId),
              "sequenceName" -> Json.fromString(seq.name)))
      )
    }.toList

    val result = TransitionResult(inputVector, System.currentTimeMillis(), outputs)
    addToHistory(result)
    result
  }

  def processInputSequence(inputVectors: List[Vector[Double]]): List[TransitionResult] =
    inputVectors.map(processInputLegacy)

  // ── Sequences active vectors ──────────────────────────────────────────────

  def getAllActiveVectors: Map[String, List[RealityVector]] =
    sequences.flatMap { case (seqId, seq) =>
      val active = seq.getActiveVectors
      if (active.nonEmpty) Some(seqId -> active) else None
    }

  def resetAllSequences(): Unit = {
    machineActors.values.foreach(_ ! MachineActor.Reset)
    sequences.values.foreach(_.reset())
    println("All sequences reset to initial state")
  }

  def resetSequence(sequenceId: String): Boolean =
    sequences.get(sequenceId).map { seq => seq.reset(); true }.getOrElse(false)

  // ── VectorStore bridge ────────────────────────────────────────────────────

  def persistAllSequences()(implicit ec: ExecutionContext): Future[Unit] =
    Future.sequence(sequences.values.map(vectorStore.storeSequence).toList).map { _ =>
      println(s"Persisted ${sequences.size} sequences to vector store")
    }

  def loadSequence(sequenceId: String)(implicit ec: ExecutionContext): Future[Option[CriticalEventSequence]] =
    vectorStore.getSequence(sequenceId).map { optSeq =>
      optSeq.foreach(addSequence)
      optSeq
    }

  def searchVectors(queryVector: Vector[Double], limit: Int = 10, threshold: Option[Double] = None)(
    implicit ec: ExecutionContext
  ): Future[List[(RealityVector, Double)]] =
    vectorStore.searchSimilar(queryVector, limit, threshold)

  // ── Stats ─────────────────────────────────────────────────────────────────

  def getStats: Json = {
    import io.circe.syntax._
    val totalVectors  = sequences.values.map(_.getAllVectors.length).sum
    val totalActive   = sequences.values.map(_.getActiveVectors.length).sum
    val seqStats = sequences.values.toList.map { seq =>
      Json.obj(
        "id"    -> Json.fromString(seq.id),
        "name"  -> Json.fromString(seq.name),
        "stats" -> seq.getStats.asJson
      )
    }
    Json.obj(
      "totalSequences"     -> Json.fromInt(sequences.size),
      "totalVectors"       -> Json.fromInt(totalVectors),
      "totalActiveVectors" -> Json.fromInt(totalActive),
      "sequenceStats"      -> Json.arr(seqStats: _*)
    )
  }

  def getHistory(limit: Option[Int] = None): List[TransitionResult] =
    limit.fold(transitionHistory.toList)(n => transitionHistory.take(n).toList)

  def clearHistory(): Unit = { transitionHistory.clear() }

  private def addToHistory(result: TransitionResult): Unit = {
    transitionHistory.prepend(result)
    if (transitionHistory.size > maxHistorySize)
      transitionHistory.removeLast()
  }
}

object RealityEngine {
  val JsonTrue: Json = Json.fromBoolean(true)

  // Ask timeout for MachineActor interactions. Machine processing is fast
  // (microseconds), so 5 s is a generous safety margin.
  implicit val askTimeout: Timeout = Timeout(5.seconds)
}
