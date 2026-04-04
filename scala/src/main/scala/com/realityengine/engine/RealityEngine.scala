package com.realityengine.engine

import com.realityengine.models._
import com.realityengine.services.VectorStore
import scala.concurrent.{ExecutionContext, Future}
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
 */
class RealityEngine(
  val vectorStore:       VectorStore,
  val maxHistorySize:    Int     = 1000,
  val universalDimension: Int    = 256,
  val verboseLogging:    Boolean = false
) {
  private var sequences:         Map[String, CriticalEventSequence] = Map.empty
  private var machines:          Map[String, Machine]               = Map.empty
  private var checkpoints:       Map[String, Map[String, MachineCheckpoint]] = Map.empty
  // Circular buffer: newest at index 0, oldest at the tail.
  // prepend is O(1) amortized; removeLast is O(1) amortized.
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
    machines = machines + (machine.id -> machine)
    machine.getAllSequences.foreach(addSequence)
    println(s"Added machine: ${machine.name} (${machine.id}) with ${machine.getSequenceCount} sequences")
  }

  def removeMachine(machineId: String): Boolean = {
    machines.get(machineId) match {
      case None => false
      case Some(machine) =>
        machine.getSequenceIds.foreach(removeSequence)
        machines = machines - machineId
        true
    }
  }

  def getMachine(id: String): Option[Machine] = machines.get(id)
  def getAllMachines: List[Machine]            = machines.values.toList

  // ── Processing ────────────────────────────────────────────────────────────

  /**
   * Process a machine-dimension input vector through a specific machine via
   * the PreceptionEngine (embeds it in a zero-padded universal space first).
   */
  def processMachineInput(machineId: String, inputVector: Vector[Double]): MachineTransitionResult = {
    val machine = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    val mapping = machine.perceptualMapping.getOrElse(
      throw new IllegalStateException(
        s"""Machine "${machine.name}" has no perceptual mapping — configure one or use /process-universal."""))
    require(inputVector.length == mapping.input.length,
      s"Input vector length ${inputVector.length} does not match machine input region length ${mapping.input.length}")

    val universalSpace = Vector.fill(universalDimension)(0.0)
      .patch(mapping.input.offset, inputVector, inputVector.length)
    processUniversalInput(universalSpace, machineId)
  }

  /**
   * Process a full universal input space through one specific machine.
   */
  def processUniversalInput(universalInputSpace: Vector[Double], machineId: String): MachineTransitionResult = {
    val machine    = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    val machineInput = preceptionEngine.resolveInputEventVectorForMachine(universalInputSpace, machine)
    val result     = machine.processInput(machineInput)

    machine.perceptualMapping.foreach { mapping =>
      if (result.arbiterMetadata.shouldOutput) {
        result.sequenceResults.values.foreach { sr =>
          sr.assertedOutputs.foreach { ao =>
            preceptionEngine.mergeOutputIntoPerceptualSpace(ao.vector, mapping)
          }
        }
      }
    }

    if (verboseLogging)
      println(s"[RealityEngine] machine=${machine.name} id=$machineId " +
        s"sequencesWithOutput=${result.arbiterMetadata.sequencesWithOutput} " +
        s"shouldOutput=${result.arbiterMetadata.shouldOutput} ts=${result.timestamp}")

    // Tag machineOutput metadata.
    // Static Json values computed once outside the per-output map.
    val tagMachineId    = Json.fromString(machineId)
    val tagMachineName  = Json.fromString(machine.name)
    val tagDim          = Json.fromInt(universalInputSpace.length)
    val tagMerged       = Json.fromBoolean(result.arbiterMetadata.shouldOutput && machine.perceptualMapping.isDefined)
    result.copy(machineOutput = result.machineOutput.map { ov =>
      ov.copy(metadata = ov.metadata ++
        Map("machineId"                    -> tagMachineId,
            "machineName"                  -> tagMachineName,
            "preceptionUsed"               -> RealityEngine.JsonTrue,
            "universalSpaceDimension"      -> tagDim,
            "outputMergedToPerceptualSpace"-> tagMerged))
    })
  }

  /**
   * Process universal input through ALL machines (input-atomic: all inputs snapshotted first).
   */
  def processUniversalInputForAllMachines(universalInputSpace: Vector[Double]): Map[String, MachineTransitionResult] = {
    val resolvedInputs = preceptionEngine.resolveInputsForMachines(universalInputSpace, machines)

    // Pre-compute the constant tag values once per call, not once per machine/output.
    val tagDim = Json.fromInt(universalInputSpace.length)

    // Phase 2: process each machine — carry machine reference so Phase 3 needs no Map lookup.
    val resultPairs: Iterable[(Machine, String, MachineTransitionResult)] =
      machines.flatMap { case (machineId, machine) =>
        resolvedInputs.get(machineId).map { machineInput =>
          try {
            val result = machine.processInput(machineInput)
            // Per-machine tag values computed once, shared across all outputs of this machine.
            val tagMachineId   = Json.fromString(machineId)
            val tagMachineName = Json.fromString(machine.name)
            val tagged = result.copy(machineOutput = result.machineOutput.map { ov =>
              ov.copy(metadata = ov.metadata ++
                Map("machineId"              -> tagMachineId,
                    "machineName"            -> tagMachineName,
                    "preceptionUsed"         -> RealityEngine.JsonTrue,
                    "universalSpaceDimension"-> tagDim))
            })
            (machine, machineId, tagged)
          } catch { case e: Exception =>
            System.err.println(s"Error processing machine $machineId: ${e.getMessage}")
            throw e
          }
        }
      }

    // Phase 3: merge all outputs — machine ref already in scope; single-pass flatten over outputs.
    for ((machine, machineId, result) <- resultPairs if result.arbiterMetadata.shouldOutput) {
      machine.perceptualMapping.foreach { mapping =>
        result.sequenceResults.valuesIterator.flatMap(_.assertedOutputs).foreach { ao =>
          try preceptionEngine.mergeOutputIntoPerceptualSpace(ao.vector, mapping)
          catch { case e: Exception =>
            System.err.println(s"Failed to merge output for machine $machineId: ${e.getMessage}")
          }
        }
      }
    }

    resultPairs.map { case (_, machineId, result) => machineId -> result }.toMap
  }

  def getDiagnosticMapping(universalInputSpace: Vector[Double]): io.circe.Json =
    preceptionEngine.getDiagnosticMapping(universalInputSpace, machines)

  // ── What-if ───────────────────────────────────────────────────────────────

  def processWhatIf(machineId: String, inputVector: Vector[Double]): MachineTransitionResult = {
    val machine = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    machine.clone().processInput(inputVector)
  }

  def processUniversalWhatIf(universalInputSpace: Vector[Double], machineId: String): MachineTransitionResult = {
    val machine    = machines.getOrElse(machineId, throw new NoSuchElementException(s"Machine not found: $machineId"))
    val machineInput = preceptionEngine.resolveInputEventVectorForMachine(universalInputSpace, machine)
    machine.clone().processInput(machineInput)
  }

  // ── Checkpoints ───────────────────────────────────────────────────────────

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
    transitionHistory.prepend(result)           // O(1) amortized — newest at front
    if (transitionHistory.size > maxHistorySize)
      transitionHistory.removeLast()            // O(1) amortized — evict oldest
  }
}

object RealityEngine {
  // Singleton Json values shared across all tag-metadata calls.
  // Avoids allocating Json.fromBoolean(true) on every machine output.
  val JsonTrue: Json = Json.fromBoolean(true)
}
