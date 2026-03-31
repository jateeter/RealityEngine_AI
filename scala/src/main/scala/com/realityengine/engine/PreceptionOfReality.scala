package com.realityengine.engine

/**
 * PreceptionOfReality — transforms raw observations into normalized InputRealityVectors.
 */

case class RawObservation(
  data:      Vector[Double],
  timestamp: Long,
  source:    Option[String]              = None,
  metadata:  Map[String, io.circe.Json]  = Map.empty
)

case class ProcessedPerception(
  inputVector:           Vector[Double],
  originalObservation:   RawObservation,
  processingTimestamp:   Long,
  transformations:       List[String]
)

class PreceptionOfReality(
  val vectorDimension:       Int,
  val preprocessingEnabled:  Boolean = true
) {
  type TransformFunction = Vector[Double] => Vector[Double]
  private var transformers: List[TransformFunction] = Nil

  if (preprocessingEnabled) addDefaultTransformers()

  def addTransformer(t: TransformFunction): Unit = { transformers = transformers :+ t }
  def clearTransformers(): Unit = { transformers = Nil }

  def perceive(observation: RawObservation): ProcessedPerception = {
    var vectorData       = observation.data
    val transformations  = scala.collection.mutable.ListBuffer.empty[String]

    transformers.foreach { t => vectorData = t(vectorData) }

    vectorData = ensureDimension(vectorData)
    transformations += "dimension-normalization"

    ProcessedPerception(
      inputVector          = vectorData,
      originalObservation  = observation,
      processingTimestamp  = System.currentTimeMillis(),
      transformations      = transformations.toList
    )
  }

  def perceiveMultiple(observations: List[RawObservation]): List[ProcessedPerception] =
    observations.map(perceive)

  private def ensureDimension(v: Vector[Double]): Vector[Double] = {
    if (v.length == vectorDimension)      v
    else if (v.length < vectorDimension)  v ++ Vector.fill(vectorDimension - v.length)(0.0)
    else                                  v.take(vectorDimension)
  }

  private def addDefaultTransformers(): Unit =
    addTransformer { data =>
      val mx   = math.max(data.max, 1.0)
      val mn   = math.min(data.min, 0.0)
      val range = mx - mn
      if (range == 0.0) data else data.map(v => (v - mn) / range)
    }

  def getConfig: Map[String, Any] = Map(
    "vectorDimension"      -> vectorDimension,
    "preprocessingEnabled" -> preprocessingEnabled,
    "transformerCount"     -> transformers.length
  )
}

object PreceptionOfReality {
  def createObservation(
    data:     Vector[Double],
    source:   Option[String]             = None,
    metadata: Map[String, io.circe.Json] = Map.empty
  ): RawObservation =
    RawObservation(data = data, timestamp = System.currentTimeMillis(), source = source, metadata = metadata)
}
