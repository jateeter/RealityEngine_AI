package com.realityengine.models

/**
 * PerceptualSpace — manages the shared n-dimensional perceptual reality space (En).
 *
 * Architecture:
 *  - En: the complete event space (default 256 dimensions)
 *  - Machines view subsets of En via offset/length mappings (Em)
 *  - Machine outputs are merged back into En to update reality perception
 */
class PerceptualSpace(val dimension: Int = 256) {
  private var perceptualVector: Vector[Double] = Vector.fill(dimension)(0.0)

  // ── Accessors ────────────────────────────────────────────────────────────

  def getPerceptualVector: Vector[Double] = perceptualVector

  def setPerceptualVector(v: Vector[Double]): Unit = {
    require(v.length == dimension,
      s"Perceptual vector must be of dimension $dimension, got ${v.length}")
    perceptualVector = v
  }

  // ── Machine I/O ──────────────────────────────────────────────────────────

  def extractMachineInput(mapping: PerceptualMapping): Vector[Double] = {
    val RegionMapping(offset, length) = mapping.input
    require(offset >= 0 && offset < dimension,
      s"Input offset $offset is out of bounds [0, $dimension)")
    require(offset + length <= dimension,
      s"Input mapping [$offset, ${offset + length}) exceeds dimension $dimension")
    perceptualVector.slice(offset, offset + length)
  }

  def mergeMachineOutput(outputVector: Vector[Double], mapping: PerceptualMapping): Unit = {
    val RegionMapping(offset, length) = mapping.output
    require(offset >= 0 && offset < dimension,
      s"Output offset $offset is out of bounds [0, $dimension)")
    require(offset + length <= dimension,
      s"Output mapping [$offset, ${offset + length}) exceeds dimension $dimension")
    require(outputVector.length == length,
      s"Output vector length ${outputVector.length} does not match mapping length $length")
    perceptualVector = perceptualVector.patch(offset, outputVector, length)
  }

  // ── Region helpers ────────────────────────────────────────────────────────

  def updateRegion(offset: Int, values: Vector[Double]): Unit = {
    require(offset >= 0 && offset < dimension,
      s"Offset $offset is out of bounds [0, $dimension)")
    require(offset + values.length <= dimension,
      s"Update region [$offset, ${offset + values.length}) exceeds dimension $dimension")
    perceptualVector = perceptualVector.patch(offset, values, values.length)
  }

  def getRegion(offset: Int, length: Int): Vector[Double] = {
    require(offset >= 0 && offset < dimension,
      s"Offset $offset is out of bounds [0, $dimension)")
    require(offset + length <= dimension,
      s"Region [$offset, ${offset + length}) exceeds dimension $dimension")
    perceptualVector.slice(offset, offset + length)
  }

  def reset(): Unit = { perceptualVector = Vector.fill(dimension)(0.0) }

  // ── Serialisation ─────────────────────────────────────────────────────────

  def toJson: io.circe.Json = {
    import io.circe.Json
    import io.circe.syntax._
    Json.obj(
      "dimension"        -> Json.fromInt(dimension),
      "perceptualVector" -> perceptualVector.asJson
    )
  }
}

object PerceptualSpace {
  def fromJson(json: io.circe.Json): PerceptualSpace = {
    val c    = json.hcursor
    val dim  = c.get[Int]("dimension").getOrElse(256)
    val ps   = new PerceptualSpace(dim)
    val vec  = c.downField("perceptualVector").as[Vector[Double]].getOrElse(Vector.fill(dim)(0.0))
    ps.setPerceptualVector(vec)
    ps
  }

  def validateMapping(mapping: PerceptualMapping, dimension: Int): (Boolean, List[String]) = {
    var errors = List.empty[String]
    val RegionMapping(iOff, iLen) = mapping.input
    val RegionMapping(oOff, oLen) = mapping.output
    if (iOff < 0)                        errors = errors :+ s"Input offset $iOff must be non-negative"
    if (iLen <= 0)                        errors = errors :+ s"Input length $iLen must be positive"
    if (iOff + iLen > dimension)          errors = errors :+ s"Input mapping [$iOff, ${iOff + iLen}) exceeds dimension $dimension"
    if (oOff < 0)                        errors = errors :+ s"Output offset $oOff must be non-negative"
    if (oLen <= 0)                        errors = errors :+ s"Output length $oLen must be positive"
    if (oOff + oLen > dimension)          errors = errors :+ s"Output mapping [$oOff, ${oOff + oLen}) exceeds dimension $dimension"
    (errors.isEmpty, errors)
  }
}
