package com.realityengine.services

import com.realityengine.models._
import sttp.client3._
import io.circe.Json
import io.circe.syntax._
import io.circe.parser._
import scala.concurrent.{ExecutionContext, Future, blocking}
import java.util.UUID

/**
 * VectorStore — Qdrant REST API integration via sttp.
 *
 * Uses the blocking sttp backend wrapped in Future for non-blocking integration
 * with the Akka HTTP server.
 */
class VectorStore(
  qdrantUrl:       String  = sys.env.getOrElse("QDRANT_URL", "http://localhost:6333"),
  collectionName:  String  = sys.env.getOrElse("COLLECTION_NAME", "reality-vectors"),
  vectorDimension: Int     = sys.env.getOrElse("VECTOR_DIMENSION", "256").toIntOption.getOrElse(256)
)(implicit backend: SttpBackend[Identity, Any]) {

  private var initialized = false

  private val seqCollection = s"${collectionName}_sequences"

  // ── Initialization ────────────────────────────────────────────────────────

  def initialize()(implicit ec: ExecutionContext): Future[Unit] = Future {
    blocking {
      try {
        ensureCollection(collectionName)
        initialized = true
        println("VectorStore initialized successfully")
      } catch { case e: Exception =>
        System.err.println(s"Failed to initialize VectorStore: ${e.getMessage}")
        throw e
      }
    }
  }

  private def ensureCollection(name: String): Unit = {
    val collectionsResp = basicRequest
      .get(uri"$qdrantUrl/collections")
      .response(asString)
      .send(backend)

    val body       = collectionsResp.body.getOrElse("{}")
    val existing   = parse(body).getOrElse(Json.Null)
    val names      = existing.hcursor.downField("result").downField("collections")
      .as[Vector[Json]].getOrElse(Vector.empty)
      .flatMap(_.hcursor.get[String]("name").toOption)

    if (!names.contains(name)) {
      val createBody = Json.obj(
        "vectors" -> Json.obj(
          "size"     -> Json.fromInt(vectorDimension),
          "distance" -> Json.fromString("Cosine")
        )
      )
      val createResp = basicRequest
        .put(uri"$qdrantUrl/collections/$name")
        .contentType("application/json")
        .body(createBody.noSpaces)
        .response(asString)
        .send(backend)
      if (createResp.code.code >= 300)
        throw new RuntimeException(s"Failed to create collection $name: ${createResp.body}")
      println(s"Created collection: $name")
    }
  }

  // ── Vector storage ────────────────────────────────────────────────────────

  def storeVector(vector: RealityVector)(implicit ec: ExecutionContext): Future[Unit] = Future {
    blocking {
      val point = Json.obj(
        "id"      -> Json.fromString(vector.id),
        "vector"  -> normalizeVector(vector.getVector).asJson,
        "payload" -> (vector.toJson.deepMerge(Json.obj("timestamp" -> Json.fromLong(System.currentTimeMillis()))))
      )
      upsertPoints(collectionName, Vector(point))
    }
  }

  def storeVectors(vectors: List[RealityVector])(implicit ec: ExecutionContext): Future[Unit] = Future {
    blocking {
      val points = vectors.map { v =>
        Json.obj(
          "id"      -> Json.fromString(v.id),
          "vector"  -> normalizeVector(v.getVector).asJson,
          "payload" -> v.toJson.deepMerge(Json.obj("timestamp" -> Json.fromLong(System.currentTimeMillis())))
        )
      }
      upsertPoints(collectionName, points.toVector)
    }
  }

  def getVector(id: String)(implicit ec: ExecutionContext): Future[Option[RealityVector]] = Future {
    blocking {
      val resp = basicRequest
        .post(uri"$qdrantUrl/collections/$collectionName/points")
        .contentType("application/json")
        .body(Json.obj("ids" -> Json.arr(Json.fromString(id)), "with_payload" -> Json.fromBoolean(true)).noSpaces)
        .response(asString)
        .send(backend)
      val body   = resp.body.getOrElse("{}")
      val result = parse(body).getOrElse(Json.Null)
      result.hcursor.downField("result").as[Vector[Json]].toOption
        .flatMap(_.headOption)
        .flatMap(_.hcursor.downField("payload").as[Json].toOption)
        .map(RealityVector.fromJson)
    }
  }

  def searchSimilar(
    queryVector: Vector[Double],
    limit:       Int = 10,
    threshold:   Option[Double] = None
  )(implicit ec: ExecutionContext): Future[List[(RealityVector, Double)]] = Future {
    blocking {
      val bodyFields = scala.collection.mutable.Map(
        "vector"       -> normalizeVector(queryVector).asJson,
        "limit"        -> Json.fromInt(limit),
        "with_payload" -> Json.fromBoolean(true)
      )
      threshold.foreach(t => bodyFields += ("score_threshold" -> Json.fromDoubleOrNull(t)))
      val body = Json.fromFields(bodyFields.toSeq)
      val resp = basicRequest
        .post(uri"$qdrantUrl/collections/$collectionName/points/search")
        .contentType("application/json")
        .body(body.noSpaces)
        .response(asString)
        .send(backend)
      val respBody = resp.body.getOrElse("{}")
      val result   = parse(respBody).getOrElse(Json.Null)
      result.hcursor.downField("result").as[Vector[Json]].getOrElse(Vector.empty).toList.flatMap { pt =>
        for {
          payload <- pt.hcursor.downField("payload").as[Json].toOption
          score   <- pt.hcursor.get[Double]("score").toOption
        } yield (RealityVector.fromJson(payload), score)
      }
    }
  }

  // ── Sequence storage ──────────────────────────────────────────────────────

  def storeSequence(seq: CriticalEventSequence)(implicit ec: ExecutionContext): Future[Unit] = Future {
    blocking {
      storeVectors(seq.getAllVectors)
      ensureCollection(seqCollection)
      val dummy  = Vector.fill(vectorDimension)(0.0)
      val point  = Json.obj(
        "id"      -> Json.fromString(seq.id),
        "vector"  -> dummy.asJson,
        "payload" -> seq.toJson
      )
      upsertPoints(seqCollection, Vector(point))
    }
  }

  def getSequence(id: String)(implicit ec: ExecutionContext): Future[Option[CriticalEventSequence]] = Future {
    blocking {
      try {
        val resp = basicRequest
          .post(uri"$qdrantUrl/collections/$seqCollection/points")
          .contentType("application/json")
          .body(Json.obj("ids" -> Json.arr(Json.fromString(id)), "with_payload" -> Json.fromBoolean(true)).noSpaces)
          .response(asString)
          .send(backend)
        val body   = resp.body.getOrElse("{}")
        val result = parse(body).getOrElse(Json.Null)
        result.hcursor.downField("result").as[Vector[Json]].toOption
          .flatMap(_.headOption)
          .flatMap(_.hcursor.downField("payload").as[Json].toOption)
          .map(CriticalEventSequence.fromJson)
      } catch { case _: Exception => None }
    }
  }

  def deleteVector(id: String)(implicit ec: ExecutionContext): Future[Unit] = Future {
    blocking {
      basicRequest
        .post(uri"$qdrantUrl/collections/$collectionName/points/delete")
        .contentType("application/json")
        .body(Json.obj("points" -> Json.arr(Json.fromString(id))).noSpaces)
        .response(asString)
        .send(backend)
    }
  }

  def getStats()(implicit ec: ExecutionContext): Future[Json] = Future {
    blocking {
      val resp = basicRequest
        .get(uri"$qdrantUrl/collections/$collectionName")
        .response(asString)
        .send(backend)
      parse(resp.body.getOrElse("{}")).getOrElse(Json.Null)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private def upsertPoints(collection: String, points: Vector[Json]): Unit = {
    val body = Json.obj("wait" -> Json.fromBoolean(true), "points" -> points.asJson)
    val resp = basicRequest
      .put(uri"$qdrantUrl/collections/$collection/points")
      .contentType("application/json")
      .body(body.noSpaces)
      .response(asString)
      .send(backend)
    if (resp.code.code >= 300)
      throw new RuntimeException(s"Failed to upsert points into $collection: ${resp.body}")
  }

  // Normalize in-place on a pre-sized Array[Double] (zero-initialized by the JVM).
  // Avoids the Vector.fill + ++ or .take allocations of the previous implementation.
  // Callers pass the result directly to .asJson — Array[Double] has a circe Encoder.
  private def normalizeVector(v: Vector[Double]): Array[Double] = {
    val arr = new Array[Double](vectorDimension)  // zero-filled by JVM
    val len = math.min(v.length, vectorDimension)
    var i = 0
    while (i < len) { arr(i) = v(i); i += 1 }
    arr
  }
}
