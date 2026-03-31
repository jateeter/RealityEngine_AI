package com.realityengine.models

import io.circe.Json

/**
 * Machine — a collection of CriticalEventSequences that work together.
 *
 * Implements the 3-phase Reality Engine workflow:
 *   Phase 1: Resolve new input reality vector
 *   Phase 2: Apply input to all active sequences
 *   Phase 3: Resolve output reality vector via arbiter
 */
class Machine(
  val name:             String,
  val description:      String                    = "",
  val metadata:         Map[String, Json]         = Map.empty,
  arbiterRule:          ArbiterRule               = ArbiterRule.PASSTHROUGH,
  var perceptualMapping: Option[PerceptualMapping] = None,
  val id:               String                    = s"machine-${System.currentTimeMillis()}-${java.util.UUID.randomUUID().toString.take(9)}"
) {
  var matchAlgorithm: ComparatorType = ComparatorType.GTE

  private var sequences: Map[String, CriticalEventSequence] = Map.empty
  private val arbiter = new OutputArbiter(arbiterRule)

  // ── Sequence management ───────────────────────────────────────────────────

  def addSequence(seq: CriticalEventSequence): Unit    = { sequences = sequences + (seq.id -> seq) }
  def removeSequence(seqId: String): Unit              = { sequences = sequences - seqId }
  def getSequence(seqId: String): Option[CriticalEventSequence] = sequences.get(seqId)
  def getAllSequences: List[CriticalEventSequence]      = sequences.values.toList
  def getSequenceCount: Int                            = sequences.size
  def getTotalVectorCount: Int                         = getAllSequences.map(_.getAllVectors.length).sum
  def getSequenceIds: List[String]                     = sequences.keys.toList
  def hasSequence(seqId: String): Boolean              = sequences.contains(seqId)

  def getArbiter: OutputArbiter = arbiter
  def setArbiterRule(r: ArbiterRule): Unit = arbiter.setRule(r)

  // ── Processing ────────────────────────────────────────────────────────────

  /**
   * Process an input vector through all sequences and resolve machine output.
   */
  def processInput(
    inputVector:            Vector[Double],
    matchAlgorithmOverride: Option[ComparatorType] = None
  ): MachineTransitionResult = {
    // Phase 2: process all sequences
    val seqResults     = scala.collection.mutable.Map.empty[String, SequenceResult]
    val seqOutputsMap  = scala.collection.mutable.Map.empty[String, List[OutputVector]]

    for ((seqId, seq) <- sequences) {
      val sr = seq.transition(inputVector, matchAlgorithmOverride)
      seqResults(seqId)    = sr
      seqOutputsMap(seqId) = sr.assertedOutputs
    }

    // Phase 3: arbiter
    val decision = arbiter.arbitrate(seqOutputsMap.toMap, sequences.size)

    MachineTransitionResult(
      inputVector     = inputVector,
      timestamp       = System.currentTimeMillis(),
      sequenceResults = seqResults.toMap,
      machineOutput   = decision.machineOutput,
      arbiterMetadata = ArbiterMetadata(
        rule                = ArbiterRule.serialize(decision.rule),
        totalInputs         = decision.totalInputs,
        sequencesWithOutput = decision.sequencesWithOutput,
        shouldOutput        = decision.shouldOutput
      )
    )
  }

  /**
   * Process input extracted from the perceptual space and merge output back.
   */
  def processInputFromPerceptualSpace(perceptualSpace: PerceptualSpace): MachineTransitionResult = {
    val mapping = perceptualMapping.getOrElse(
      throw new IllegalStateException(s"Machine $name does not have a perceptual mapping configured"))
    val machineInput = perceptualSpace.extractMachineInput(mapping)
    val result       = processInput(machineInput)
    result.machineOutput.foreach { ov =>
      perceptualSpace.mergeMachineOutput(ov.vector, mapping)
    }
    result
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  def reset(): Unit = sequences.values.foreach(_.reset())

  // ── Clone ─────────────────────────────────────────────────────────────────

  override def clone(): Machine = {
    val clonedMapping = perceptualMapping.map(m =>
      PerceptualMapping(
        input  = RegionMapping(m.input.offset,  m.input.length),
        output = RegionMapping(m.output.offset, m.output.length)
      )
    )
    val c = new Machine(name, description, metadata, arbiter.getRule, clonedMapping, id)
    c.matchAlgorithm = matchAlgorithm
    sequences.values.foreach(seq => c.addSequence(seq.clone()))
    c
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  def toJson: Json = {
    import io.circe.syntax._
    val mappingJson = perceptualMapping.map { m =>
      Json.obj(
        "input"  -> Json.obj("offset" -> Json.fromInt(m.input.offset),  "length" -> Json.fromInt(m.input.length)),
        "output" -> Json.obj("offset" -> Json.fromInt(m.output.offset), "length" -> Json.fromInt(m.output.length))
      )
    }.getOrElse(Json.Null)

    Json.obj(
      "id"               -> Json.fromString(id),
      "name"             -> Json.fromString(name),
      "description"      -> Json.fromString(description),
      "matchAlgorithm"   -> Json.fromString(ComparatorType.serialize(matchAlgorithm)),
      "arbiterRule"      -> Json.fromString(ArbiterRule.serialize(arbiter.getRule)),
      "sequenceCount"    -> Json.fromInt(getSequenceCount),
      "totalVectors"     -> Json.fromInt(getTotalVectorCount),
      "sequenceIds"      -> Json.arr(getSequenceIds.map(Json.fromString): _*),
      "sequences"        -> Json.arr(getAllSequences.map(seq =>
        Json.obj("id" -> Json.fromString(seq.id), "name" -> Json.fromString(seq.name))
      ): _*),
      "metadata"         -> metadata.asJson,
      "perceptualMapping" -> mappingJson
    )
  }

  /** Full serialization including sequence internals. */
  def toFullJson: Json = {
    import io.circe.syntax._
    val base = toJson.asObject.get
    val withSequences = base.add("sequences", Json.arr(getAllSequences.map(_.toJson): _*))
    Json.fromJsonObject(withSequences)
  }
}

object Machine {
  def fromFullJson(json: Json): Machine = {
    val c           = json.hcursor
    val id          = c.get[String]("id").getOrElse(s"machine-${System.currentTimeMillis()}")
    val name        = c.get[String]("name").getOrElse("unnamed")
    val description = c.get[String]("description").getOrElse("")
    val algoStr     = c.get[String]("matchAlgorithm").toOption
    val arbiterStr  = c.get[String]("arbiterRule").toOption
    val metadata    = c.downField("metadata").as[Map[String, Json]].getOrElse(Map.empty)

    val mapping = c.downField("perceptualMapping").as[Json].toOption.flatMap { mj =>
      if (mj.isNull) None
      else {
        val mc = mj.hcursor
        for {
          iOff <- mc.downField("input").get[Int]("offset").toOption
          iLen <- mc.downField("input").get[Int]("length").toOption
          oOff <- mc.downField("output").get[Int]("offset").toOption
          oLen <- mc.downField("output").get[Int]("length").toOption
        } yield PerceptualMapping(RegionMapping(iOff, iLen), RegionMapping(oOff, oLen))
      }
    }

    val arbiterRule = arbiterStr.map(ArbiterRule.fromString).getOrElse(ArbiterRule.PASSTHROUGH)
    val machine = new Machine(name, description, metadata, arbiterRule, mapping, id)
    machine.matchAlgorithm = algoStr.map(ComparatorType.fromString).getOrElse(ComparatorType.GTE)

    c.downField("sequences").as[Vector[Json]].getOrElse(Vector.empty).foreach { sj =>
      machine.addSequence(CriticalEventSequence.fromJson(sj))
    }
    machine
  }
}
