package com.realityengine.models

/**
 * PerceptualSpace — manages the shared n-dimensional perceptual reality space (En).
 *
 * Architecture:
 *  - En: the complete event space (dimension driven by VECTOR_DIMENSION env var)
 *  - Machines view subsets of En via offset/length mappings (Em)
 *  - Machine outputs are merged back into En to update reality perception
 *
 * Implementation note:
 *  The backing store is a mutable Array[Double].  All hot-path mutations
 *  (mergeMachineOutput, updateRegion) write directly into the array —
 *  no full-vector allocation per merge.  An immutable Vector[Double] snapshot
 *  is produced only by getPerceptualVector / extractMachineInput / getRegion,
 *  which are called at most once per simulation step.
 */
class PerceptualSpace(val dimension: Int = sys.env.getOrElse("VECTOR_DIMENSION", "768").toIntOption.getOrElse(768)) {
  private val perceptualArray: Array[Double] = new Array[Double](dimension)

  // ── Accessors ────────────────────────────────────────────────────────────

  /** Returns an immutable snapshot of the full space. O(n) — call sparingly. */
  def getPerceptualVector: Vector[Double] = perceptualArray.toVector

  def setPerceptualVector(v: Vector[Double]): Unit = {
    require(v.length == dimension,
      s"Perceptual vector must be of dimension $dimension, got ${v.length}")
    var i = 0
    while (i < dimension) { perceptualArray(i) = v(i); i += 1 }
  }

  // ── Machine I/O ──────────────────────────────────────────────────────────

  def extractMachineInput(mapping: PerceptualMapping): Vector[Double] = {
    val RegionMapping(offset, length) = mapping.input
    require(offset >= 0 && offset < dimension,
      s"Input offset $offset is out of bounds [0, $dimension)")
    require(offset + length <= dimension,
      s"Input mapping [$offset, ${offset + length}) exceeds dimension $dimension")
    val slice = new Array[Double](length)
    System.arraycopy(perceptualArray, offset, slice, 0, length)
    slice.toVector
  }

  /** In-place write — O(outputVector.length), no full-vector allocation. */
  def mergeMachineOutput(outputVector: Vector[Double], mapping: PerceptualMapping): Unit = {
    val RegionMapping(offset, length) = mapping.output
    // Single compound require — validates all three conditions in one pass.
    require(offset >= 0 && offset + length <= dimension && outputVector.length == length,
      s"Invalid output mapping: offset=$offset length=$length vectorLen=${outputVector.length} dimension=$dimension")
    var i = 0
    while (i < length) { perceptualArray(offset + i) = outputVector(i); i += 1 }
  }

  // ── Region helpers ────────────────────────────────────────────────────────

  /** In-place write — O(values.length), no full-vector allocation. */
  def updateRegion(offset: Int, values: Vector[Double]): Unit = {
    // Single compound require — validates both bounds in one pass.
    require(offset >= 0 && offset + values.length <= dimension,
      s"Update region [$offset, ${offset + values.length}) out of bounds for dimension $dimension")
    var i = 0
    val len = values.length
    while (i < len) { perceptualArray(offset + i) = values(i); i += 1 }
  }

  def getRegion(offset: Int, length: Int): Vector[Double] = {
    require(offset >= 0 && offset < dimension,
      s"Offset $offset is out of bounds [0, $dimension)")
    require(offset + length <= dimension,
      s"Region [$offset, ${offset + length}) exceeds dimension $dimension")
    val slice = new Array[Double](length)
    System.arraycopy(perceptualArray, offset, slice, 0, length)
    slice.toVector
  }

  def reset(): Unit = java.util.Arrays.fill(perceptualArray, 0.0)

  // ── Serialisation ─────────────────────────────────────────────────────────

  def toJson: io.circe.Json = {
    import io.circe.Json
    import io.circe.syntax._
    Json.obj(
      "dimension"        -> Json.fromInt(dimension),
      "perceptualVector" -> perceptualArray.toVector.asJson
    )
  }
}

object PerceptualSpace {
  def fromJson(json: io.circe.Json): PerceptualSpace = {
    val c    = json.hcursor
    val dim  = c.get[Int]("dimension").getOrElse(sys.env.getOrElse("VECTOR_DIMENSION", "768").toIntOption.getOrElse(768))
    val ps   = new PerceptualSpace(dim)
    val vec  = c.downField("perceptualVector").as[Vector[Double]].getOrElse(Vector.fill(dim)(0.0))
    ps.setPerceptualVector(vec)
    ps
  }

  def validateMapping(mapping: PerceptualMapping, dimension: Int): (Boolean, List[String]) = {
    var errors = List.empty[String]
    val RegionMapping(iOff, iLen) = mapping.input
    val RegionMapping(oOff, oLen) = mapping.output
    if (iOff < 0)               errors = errors :+ s"Input offset $iOff must be non-negative"
    if (iLen <= 0)               errors = errors :+ s"Input length $iLen must be positive"
    if (iOff + iLen > dimension) errors = errors :+ s"Input mapping [$iOff, ${iOff + iLen}) exceeds dimension $dimension"
    if (oOff < 0)               errors = errors :+ s"Output offset $oOff must be non-negative"
    if (oLen <= 0)               errors = errors :+ s"Output length $oLen must be positive"
    if (oOff + oLen > dimension) errors = errors :+ s"Output mapping [$oOff, ${oOff + oLen}) exceeds dimension $dimension"
    (errors.isEmpty, errors)
  }
}
