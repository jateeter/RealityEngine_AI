package com.realityengine.api

import akka.actor.ActorSystem
import akka.http.scaladsl.model._
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{ExceptionHandler, Route}
import com.realityengine.engine._
import com.realityengine.models._
import com.realityengine.services.MachineLoader
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.Json
import io.circe.syntax._
import JsonProtocol._

import akka.actor.Cancellable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.{Failure, Success, Try}
import java.io.File
import java.nio.file.Files
import scala.collection.concurrent.TrieMap
import com.realityengine.logging.{AuditConfig, AuditLogger}

// Routes — Akka HTTP route definitions mirroring all TypeScript /api/... endpoints.
class Routes(
  engine:      RealityEngine,
  simulator:   PerceptualSpaceSimulator,
  auditCfg:    AuditConfig,
  machinesDir: String = sys.env.getOrElse("MACHINES_DIR", "examples/machines")
)(implicit system: ActorSystem, ec: ExecutionContext) {

  private val perception = new PreceptionOfReality(
    sys.env.getOrElse("VECTOR_DIMENSION", "256").toIntOption.getOrElse(256))
  private var sampler: Option[RealitySampler] = None

  // JSON file cache: path -> (lastModified, rawJson).
  // Invalidated automatically when the file's mtime changes.
  private val jsonFileCache = TrieMap.empty[String, (Long, String)]

  private def readJsonFile(file: File): String = {
    val mtime = file.lastModified()
    val key   = file.getAbsolutePath
    jsonFileCache.get(key) match {
      case Some((cachedMtime, json)) if cachedMtime == mtime => json
      case _ =>
        val json = new String(Files.readAllBytes(file.toPath))
        jsonFileCache.update(key, (mtime, json))
        json
    }
  }

  // Staging buffer for chunk-based simulation configure protocol
  private var sequenceBuffer: Vector[Vector[Double]] = Vector.empty
  private var sequenceBufferConfig: Option[(RegionMapping, Long, Option[Int])] = None

  // Auto-play scheduler
  private var autoPlayTask: Option[Cancellable] = None

  private def cancelAutoPlay(): Unit = {
    autoPlayTask.foreach(_.cancel())
    autoPlayTask = None
  }

  private def startAutoPlay(delayMs: Long): Unit = {
    cancelAutoPlay()
    val task = system.scheduler.scheduleWithFixedDelay(0.milliseconds, delayMs.milliseconds) { () =>
      simulator.step() match {
        case None    => cancelAutoPlay()
        case Some(_) => ()
      }
    }
    autoPlayTask = Some(task)
  }

  implicit val exceptionHandler: ExceptionHandler = ExceptionHandler {
    case e: NoSuchElementException => complete(StatusCodes.NotFound      -> Json.obj("error" -> Json.fromString(e.getMessage)))
    case e: IllegalArgumentException => complete(StatusCodes.BadRequest   -> Json.obj("error" -> Json.fromString(e.getMessage)))
    case e: Exception              => complete(StatusCodes.InternalServerError -> Json.obj("error" -> Json.fromString(e.getMessage)))
  }

  // ── Startup: load machine JSON files ─────────────────────────────────────

  def loadDefaultMachines(): Unit = {
    val dir = new File(machinesDir)
    if (!dir.exists()) { println(s"Machines directory not found: $machinesDir"); return }

    // Auto-discover every .json file in the machines directory so newly-added
    // example machines (DC*, AIWellnessCoach, future additions) get loaded
    // without having to edit this list. Sorted for stable, reproducible
    // startup logs.
    val jsonFiles = Option(dir.listFiles((_, name) => name.toLowerCase.endsWith(".json")))
      .getOrElse(Array.empty[File])
      .sortBy(_.getName)

    if (jsonFiles.isEmpty) {
      println(s"No machine JSON files found in $machinesDir")
      return
    }

    var loaded = 0; var failed = 0
    println(s"Loading ${jsonFiles.length} example machines from $machinesDir...")

    jsonFiles.foreach { file =>
      val filename = file.getName
      Try {
        val json     = readJsonFile(file)
        val baseName = filename.replaceAll("\\.json$", "").toLowerCase.replaceAll("[^a-z0-9]+", "-")
        val machine  = MachineLoader.loadFromJson(json, Some(s"machine-$baseName"))
        addMachineToSystem(machine)
        println(s"  ✓ ${machine.name} loaded from $filename")
        loaded += 1
      }.failed.foreach { e =>
        println(s"  ✗ Failed to load $filename: ${e.getMessage}")
        failed += 1
      }
    }
    println(s"\nMachine loading complete: $loaded loaded, $failed failed")
  }

  private def addMachineToSystem(machine: Machine): Unit = {
    engine.addMachine(machine)
    if (machine.perceptualMapping.isDefined) {
      simulator.addMachine(machine)
      println(s"""  ✓ Machine "${machine.name}" registered with perceptual simulator""")
    }
  }

  // ── Route tree ────────────────────────────────────────────────────────────

  val routes: Route = AuditLogger.directive(auditCfg) { handleExceptions(exceptionHandler) {
    pathPrefix("api") {
      concat(
        // Health
        path("health") { get { complete(Json.obj("status" -> Json.fromString("healthy"), "timestamp" -> Json.fromLong(System.currentTimeMillis()), "version" -> Json.fromString("1.0.0"))) } },

        // Config
        pathPrefix("config") {
          concat(
            pathEnd { get { complete(Json.obj(
              "vectorDimension"   -> Json.fromInt(sys.env.getOrElse("VECTOR_DIMENSION", "256").toIntOption.getOrElse(256)),
              "matchThreshold"    -> Json.fromDouble(0.5).get,
              "qdrantUrl"         -> Json.fromString(sys.env.getOrElse("QDRANT_URL", "http://localhost:6333")),
              "collectionName"    -> Json.fromString(sys.env.getOrElse("COLLECTION_NAME", "reality-vectors"))
            )) } },
            path("dimension") { put { parameter("dimension".as[Int].?(256)) { dim =>
              complete(Json.obj("success" -> Json.fromBoolean(true), "dimension" -> Json.fromInt(dim)))
            } } },
            path("threshold") { put { parameter("threshold".as[Double].?(0.5)) { t =>
              complete(Json.obj("success" -> Json.fromBoolean(true), "threshold" -> Json.fromDoubleOrNull(t)))
            } } }
          )
        },

        // Vectors
        pathPrefix("vectors") {
          concat(
            path("search") { post { entity(as[Json]) { body =>
              val qv    = body.hcursor.downField("vector").as[Vector[Double]].getOrElse(Vector.empty)
              val limit = body.hcursor.get[Int]("limit").getOrElse(10)
              val thr   = body.hcursor.get[Double]("threshold").toOption
              onComplete(engine.searchVectors(qv, limit, thr)) {
                case Success(results) => complete(Json.obj("results" ->
                  Json.arr(results.map { case (v, s) => Json.obj("vector" -> v.toJson, "score" -> Json.fromDoubleOrNull(s)) }: _*)))
                case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } } },
            pathEnd { post { entity(as[Json]) { body =>
              val elementsJ = body.hcursor.downField("elements").as[Vector[Json]].getOrElse(Vector.empty)
              val isInitial = body.hcursor.get[Boolean]("isInitial").getOrElse(false)
              val elems = elementsJ.map { ej =>
                val ec = ej.hcursor
                VectorElement(
                  value          = ec.get[Double]("value").getOrElse(0.0),
                  comparatorType = ec.get[String]("comparatorType").toOption.map(ComparatorType.fromString),
                  threshold      = ec.get[Double]("threshold").toOption
                )
              }
              val vector = new RealityVector(elems, isInitial)
              complete(Json.obj("success" -> Json.fromBoolean(true), "vector" -> vector.toJson))
            } } },
            path(Segment) { id =>
              concat(
                get  { complete(Json.obj("message" -> Json.fromString("Vector retrieval endpoint"), "id" -> Json.fromString(id))) },
                delete { onComplete(engine.vectorStore.deleteVector(id)) {
                  case Success(_) => complete(Json.obj("success" -> Json.fromBoolean(true), "id" -> Json.fromString(id)))
                  case Failure(e) => complete(StatusCodes.InternalServerError -> Json.obj("error" -> Json.fromString(e.getMessage)))
                } }
              )
            }
          )
        },

        // Sequences
        pathPrefix("sequences") {
          concat(
            path("persist") { post { onComplete(engine.persistAllSequences()) {
              case Success(_) => complete(Json.obj("success" -> Json.fromBoolean(true)))
              case Failure(e) => complete(StatusCodes.InternalServerError -> Json.obj("error" -> Json.fromString(e.getMessage)))
            } } },
            pathEnd {
              concat(
                get  { complete(Json.obj("sequences" -> Json.arr(engine.getAllSequences.map(_.toJson): _*))) },
                post { entity(as[Json]) { body =>
                  val name  = body.hcursor.get[String]("name").getOrElse("unnamed")
                  val seq   = new CriticalEventSequence(name)
                  body.hcursor.downField("vectors").as[Vector[Json]].getOrElse(Vector.empty).foreach { vj =>
                    val vc = vj.hcursor
                    val elems = vc.downField("elements").as[Vector[Json]].getOrElse(Vector.empty).map { ej =>
                      VectorElement(
                        value          = ej.hcursor.get[Double]("value").getOrElse(0.0),
                        comparatorType = ej.hcursor.get[String]("comparatorType").toOption.map(ComparatorType.fromString),
                        threshold      = ej.hcursor.get[Double]("threshold").toOption
                      )
                    }
                    val vec = new RealityVector(elems, vc.get[Boolean]("isInitial").getOrElse(false),
                      vc.get[String]("id").getOrElse(java.util.UUID.randomUUID().toString))
                    vc.downField("nextVectorIds").as[Vector[String]].getOrElse(Vector.empty).foreach(vec.addNextVector)
                    vc.downField("outputVectors").as[Vector[Json]].getOrElse(Vector.empty).foreach { oj =>
                      vec.addOutputVector(OutputVector(
                        id        = oj.hcursor.get[String]("id").getOrElse(java.util.UUID.randomUUID().toString),
                        vector    = oj.hcursor.downField("vector").as[Vector[Double]].getOrElse(Vector.empty),
                        metadata  = oj.hcursor.downField("metadata").as[Map[String, Json]].getOrElse(Map.empty),
                        timestamp = System.currentTimeMillis()
                      ))
                    }
                    seq.addVector(vec)
                  }
                  val (valid, errors) = seq.validate()
                  if (!valid) complete(StatusCodes.BadRequest -> Json.obj("error" -> errors.asJson))
                  else { engine.addSequence(seq); complete(Json.obj("success" -> Json.fromBoolean(true), "sequence" -> seq.toJson)) }
                } }
              )
            },
            path(Segment) { id =>
              concat(
                get    { engine.getSequence(id).fold(complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Sequence not found"))))(s => complete(Json.obj("sequence" -> s.toJson))) },
                delete { if (engine.getSequence(id).isDefined) { engine.removeSequence(id); complete(Json.obj("success" -> Json.fromBoolean(true))) }
                         else complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Sequence not found"))) }
              )
            },
            path(Segment / "reset") { id =>
              post { if (engine.resetSequence(id)) complete(Json.obj("success" -> Json.fromBoolean(true)))
                     else complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Sequence not found"))) }
            },
            path(Segment / "vectors") { id =>
              post { entity(as[Json]) { body =>
                engine.getSequence(id) match {
                  case None => complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Sequence not found")))
                  case Some(seq) =>
                    val elems = body.hcursor.downField("elements").as[Vector[Json]].getOrElse(Vector.empty).map { ej =>
                      VectorElement(
                        value          = ej.hcursor.get[Double]("value").getOrElse(0.0),
                        comparatorType = ej.hcursor.get[String]("comparatorType").toOption.map(ComparatorType.fromString),
                        threshold      = ej.hcursor.get[Double]("threshold").toOption
                      )
                    }
                    val vec = new RealityVector(elems, body.hcursor.get[Boolean]("isInitial").getOrElse(false))
                    seq.addVector(vec)
                    complete(Json.obj("success" -> Json.fromBoolean(true), "vector" -> vec.toJson))
                }
              } }
            }
          )
        },

        // Engine
        pathPrefix("engine") {
          concat(
            path("process") { post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("vector").as[Vector[Double]].getOrElse(Vector.empty)
              val result = engine.processInputLegacy(vec)
              complete(Json.obj("result" -> result.asJson))
            } } },
            path("reset") { post { engine.resetAllSequences(); complete(Json.obj("success" -> Json.fromBoolean(true))) } },
            path("stats") { get { complete(Json.obj("stats" -> engine.getStats)) } },
            path("active") { get {
              val active = engine.getAllActiveVectors
              complete(Json.obj("activeVectors" -> Json.fromFields(active.view.mapValues(vs => Json.arr(vs.map(_.toJson): _*)).toSeq)))
            } },
            path("history") { get { parameter("limit".as[Int].?) { limit =>
              complete(Json.obj("history" -> engine.getHistory(limit).asJson))
            } } }
          )
        },

        // Perception
        path("perception" / "observe") { post { entity(as[Json]) { body =>
          val data     = body.hcursor.downField("data").as[Vector[Double]].getOrElse(Vector.empty)
          val source   = body.hcursor.get[String]("source").toOption
          val meta     = body.hcursor.downField("metadata").as[Map[String, Json]].getOrElse(Map.empty)
          val obs      = PreceptionOfReality.createObservation(data, source, meta)
          val perceived = perception.perceive(obs)
          complete(Json.obj(
            "success"            -> Json.fromBoolean(true),
            "inputVector"        -> perceived.inputVector.asJson,
            "transformations"    -> perceived.transformations.asJson,
            "processingTimestamp" -> Json.fromLong(perceived.processingTimestamp)
          ))
        } } },

        // Sampler
        pathPrefix("sampler") {
          concat(
            path("start") { post { entity(as[Json]) { body =>
              val strat = body.hcursor.get[String]("strategy").toOption.map {
                case "periodic"     => SamplingStrategy.PERIODIC
                case "continuous"   => SamplingStrategy.CONTINUOUS
                case "event-driven" => SamplingStrategy.EVENT_DRIVEN
                case _              => SamplingStrategy.MANUAL
              }.getOrElse(SamplingStrategy.MANUAL)
              val intervalMs = body.hcursor.get[Long]("intervalMs").toOption
              if (sampler.isEmpty) sampler = Some(new RealitySampler(perception, engine,
                SamplingConfig(strat, intervalMs)))
              sampler.get.start()
              complete(Json.obj("success" -> Json.fromBoolean(true), "stats" -> sampler.get.getStats))
            } } },
            path("stop") { post {
              sampler.foreach(_.stop())
              complete(Json.obj("success" -> Json.fromBoolean(true)))
            } },
            path("sample") { post { entity(as[Json]) { body =>
              val data   = body.hcursor.downField("data").as[Vector[Double]].getOrElse(Vector.empty)
              val source = body.hcursor.get[String]("source").toOption
              val meta   = body.hcursor.downField("metadata").as[Map[String, Json]].getOrElse(Map.empty)
              val obs    = PreceptionOfReality.createObservation(data, source, meta)
              if (sampler.isEmpty) sampler = Some(new RealitySampler(perception, engine, SamplingConfig(SamplingStrategy.MANUAL)))
              val result = sampler.get.sample(obs)
              complete(Json.obj("success" -> Json.fromBoolean(true), "result" -> result.asJson))
            } } },
            path("stats") { get {
              val statsJson = sampler.map(_.getStats).getOrElse(Json.obj("isRunning" -> Json.fromBoolean(false), "sampleCount" -> Json.fromInt(0), "bufferSize" -> Json.fromInt(0), "strategy" -> Json.fromString("MANUAL")))
              complete(Json.obj("stats" -> statsJson))
            } }
          )
        },

        // Machines — fixed paths BEFORE parameterized
        pathPrefix("machines") {
          concat(
            // Fixed: /machines/json/...
            path("json" / "list") { get {
              val dir = new File(machinesDir)
              val files = if (dir.exists()) dir.listFiles().filter(_.getName.endsWith(".json")).toList else Nil
              val machineList = files.flatMap { file =>
                Try {
                  val json = readJsonFile(file)
                  val root = io.circe.parser.parse(json).getOrElse(io.circe.Json.obj())
                  val m    = root.hcursor.downField("machine")
                  Json.obj(
                    "filename"      -> Json.fromString(file.getName),
                    "name"          -> Json.fromString(m.get[String]("name").getOrElse(file.getName)),
                    "description"   -> Json.fromString(m.get[String]("description").getOrElse("")),
                    "version"       -> Json.fromString(root.hcursor.get[String]("version").getOrElse("1.0.0")),
                    "metadata"      -> m.downField("metadata").as[Json].getOrElse(Json.obj()),
                    "sequenceCount" -> Json.fromInt(m.downField("sequences").as[Vector[Json]].map(_.length).getOrElse(0))
                  )
                }.toOption
              }
              complete(Json.obj("machines" -> Json.arr(machineList: _*)))
            } },
            path("json" / Segment) { name =>
              get {
                val file = new File(machinesDir, if (name.endsWith(".json")) name else s"$name.json")
                if (!file.exists()) complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString(s"Machine file not found: $name")))
                else Try {
                  val json    = readJsonFile(file)
                  val baseName = name.replaceAll("\\.json$", "").toLowerCase.replaceAll("[^a-z0-9]+", "-")
                  val machine = MachineLoader.loadFromJson(json, Some(s"machine-$baseName"))
                  addMachineToSystem(machine)
                  machine
                } match {
                  case Failure(e)       => complete(StatusCodes.InternalServerError -> Json.obj("error" -> Json.fromString(e.getMessage)))
                  case Success(machine) => complete(Json.obj("success" -> Json.fromBoolean(true), "machine" -> machine.toJson, "message" -> Json.fromString(s"Machine ${machine.name} loaded successfully")))
                }
              }
            },
            path("json" / "import") { post { entity(as[String]) { body =>
              Try(MachineLoader.loadFromJson(body)) match {
                case Failure(e)       => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
                case Success(machine) => addMachineToSystem(machine); complete(Json.obj("success" -> Json.fromBoolean(true), "machine" -> machine.toJson))
              }
            } } },
            // Fixed: /machines/process-universal/all
            path("process-universal" / "all") { post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("universalInputSpace").as[Vector[Double]].getOrElse(Vector.empty)
              val results = engine.processUniversalInputForAllMachines(vec)
              complete(Json.obj("results" -> Json.fromFields(results.view.mapValues(_.asJson).toSeq)))
            } } },
            // Fixed: /machines/machine-graph
            pathEnd {
              concat(
                get  { complete(Json.obj("machines" -> Json.arr(engine.getAllMachines.map(_.toJson): _*))) },
                post { entity(as[Json]) { body =>
                  Try(MachineLoader.loadFromJson(body.noSpaces)) match {
                    case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
                    case Success(machine) =>
                      addMachineToSystem(machine)
                      complete(Json.obj("success" -> Json.fromBoolean(true), "machine" -> machine.toJson))
                  }
                } }
              )
            },
            path(Segment) { id =>
              concat(
                get    { engine.getMachine(id).fold(complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Machine not found"))))(m => complete(Json.obj("machine" -> m.toJson))) },
                patch  { entity(as[Json]) { body =>
                  engine.getMachine(id).fold(
                    complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Machine not found")))
                  ) { existing =>
                    val c           = body.hcursor
                    val newName     = c.get[String]("name").getOrElse(existing.name)
                    val newDesc     = c.get[String]("description").getOrElse(existing.description)
                    val metaPatch   = c.downField("metadata").as[Map[String, Json]].getOrElse(Map.empty)
                    val newMetadata = existing.metadata ++ metaPatch
                    val updated     = new Machine(newName, newDesc, newMetadata, existing.getArbiter.getRule, existing.perceptualMapping, id)
                    updated.matchAlgorithm = existing.matchAlgorithm
                    existing.getAllSequences.foreach(updated.addSequence)
                    engine.removeMachine(id); simulator.removeMachine(id)
                    addMachineToSystem(updated)
                    complete(Json.obj("success" -> Json.fromBoolean(true), "machine" -> updated.toJson))
                  }
                } },
                put    { entity(as[Json]) { body =>
                  Try(MachineLoader.loadFromJson(body.noSpaces, Some(id))) match {
                    case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
                    case Success(machine) =>
                      engine.removeMachine(id); simulator.removeMachine(id)
                      addMachineToSystem(machine)
                      complete(Json.obj("success" -> Json.fromBoolean(true), "machine" -> machine.toJson))
                  }
                } },
                delete { engine.removeMachine(id); simulator.removeMachine(id); complete(Json.obj("success" -> Json.fromBoolean(true))) }
              )
            },
            path(Segment / "process") { id => post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("inputVector").as[Vector[Double]].getOrElse(Vector.empty)
              Try(engine.processMachineInput(id, vec)) match {
                case Success(r) => complete(r.asJson)
                case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } } },
            path(Segment / "process-universal") { id => post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("universalInputSpace").as[Vector[Double]].getOrElse(Vector.empty)
              Try(engine.processUniversalInput(vec, id)) match {
                case Success(r) => complete(r.asJson)
                case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } } },
            path(Segment / "whatif") { id => post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("inputVector").as[Vector[Double]].getOrElse(Vector.empty)
              Try(engine.processWhatIf(id, vec)) match {
                case Success(r) => complete(r.asJson)
                case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } } },
            path(Segment / "whatif-universal") { id => post { entity(as[Json]) { body =>
              val vec = body.hcursor.downField("universalInputSpace").as[Vector[Double]].getOrElse(Vector.empty)
              Try(engine.processUniversalWhatIf(vec, id)) match {
                case Success(r) => complete(r.asJson)
                case Failure(e) => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } } },
            path(Segment / "checkpoints") { id =>
              concat(
                get  { complete(Json.arr(engine.listCheckpoints(id).map(_.asJson): _*)) },
                post { entity(as[Json]) { body =>
                  val label = body.hcursor.get[String]("label").toOption
                  Try(engine.createCheckpoint(id, label)) match {
                    case Success(cpId) => complete(Json.obj("success" -> Json.fromBoolean(true), "checkpointId" -> Json.fromString(cpId)))
                    case Failure(e)    => complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString(e.getMessage)))
                  }
                } }
              )
            },
            path(Segment / "checkpoints" / Segment / "restore") { (machineId, cpId) =>
              post { Try(engine.restoreCheckpoint(machineId, cpId)) match {
                case Success(_) => complete(Json.obj("success" -> Json.fromBoolean(true)))
                case Failure(e) => complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString(e.getMessage)))
              } }
            },
            path(Segment / "checkpoints" / Segment) { (machineId, cpId) =>
              delete { complete(Json.obj("success" -> Json.fromBoolean(engine.deleteCheckpoint(machineId, cpId)))) }
            },
            path(Segment / "export") { id =>
              get { engine.getMachine(id).fold(complete(StatusCodes.NotFound -> Json.obj("error" -> Json.fromString("Machine not found")))) { m =>
                complete(HttpEntity(ContentTypes.`application/json`, MachineLoader.saveToJson(m)))
              } }
            }
          )
        },

        // Machine graph
        path("machine-graph") { get { complete(simulator.getMachineGraphData) } },

        // Perceptual simulation
        pathPrefix("perceptual-simulation") {
          concat(
            path("configure" / "chunk") { post { entity(as[Json]) { body =>
              val chunk = body.hcursor.downField("vectors").as[Vector[Vector[Double]]].getOrElse(Vector.empty)
              if (body.hcursor.downField("reset").as[Boolean].getOrElse(false)) sequenceBuffer = Vector.empty
              sequenceBuffer = sequenceBuffer ++ chunk
              // Accept config from nested "config" field OR top-level fields (backwards compat)
              val cfgSrc = body.hcursor.downField("config").as[Json].toOption.getOrElse(body)
              val c = cfgSrc.hcursor
              val hasRegion = c.downField("inputRegion").as[Json].isRight
              if (hasRegion || body.hcursor.downField("inputRegion").as[Json].isRight) {
                val src = if (hasRegion) c else body.hcursor
                val iOff = src.downField("inputRegion").get[Int]("offset").getOrElse(0)
                val iLen = src.downField("inputRegion").get[Int]("length").getOrElse(1)
                val delay = src.get[Long]("stepDelayMs").getOrElse(100L)
                val maxS  = src.get[Int]("maxSteps").toOption
                sequenceBufferConfig = Some((RegionMapping(iOff, iLen), delay, maxS))
              }
              complete(Json.obj("success" -> Json.fromBoolean(true), "bufferedVectors" -> Json.fromInt(sequenceBuffer.length)))
            } } },
            path("configure" / "commit") { post {
              sequenceBufferConfig match {
                case None => complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString("No config buffered. Send a chunk with config first.")))
                case Some((region, delay, maxS)) =>
                  val cfg = SimulationConfig(sequenceBuffer, region, delay, maxS)
                  simulator.configure(cfg)
                  sequenceBuffer = Vector.empty; sequenceBufferConfig = None
                  complete(Json.obj("success" -> Json.fromBoolean(true)))
              }
            } },
            path("start")   { post {
              try {
                simulator.start()
                val delayMs = simulator.getStepDelayMs
                startAutoPlay(delayMs)
                complete(Json.obj("success" -> Json.fromBoolean(true)))
              } catch { case e: Exception =>
                complete(StatusCodes.BadRequest -> Json.obj("error" -> Json.fromString(e.getMessage)))
              }
            } },
            path("stop")    { post { cancelAutoPlay(); simulator.stop(); complete(Json.obj("success" -> Json.fromBoolean(true))) } },
            path("step")    { post { simulator.step() match {
              case None    => complete(Json.obj("done" -> Json.fromBoolean(true), "success" -> Json.fromBoolean(true)))
              case Some(s) => complete(Json.obj("success" -> Json.fromBoolean(true), "step" -> s.asJson))
            } } },
            path("reset")   { post { simulator.reset(); complete(Json.obj("success" -> Json.fromBoolean(true))) } },
            path("state")   { get {
              val ps = simulator.getPerceptualSpace.getPerceptualVector
              val stateObj = Json.obj(
                "perceptualSpace" -> Json.arr(ps.map(Json.fromDoubleOrNull): _*),
                "currentStep"     -> Json.fromInt(simulator.getCurrentStep),
                "isRunning"       -> Json.fromBoolean(simulator.getIsRunning),
                "machines"        -> simulator.toJson.hcursor.downField("machines").as[Json].getOrElse(Json.arr())
              )
              complete(Json.obj("state" -> stateObj))
            } },
            path("history") { get { complete(Json.obj("history" -> simulator.getHistory.asJson)) } }
          )
        },

        // Preception diagnostic
        path("preception" / "diagnostic") { post { entity(as[Json]) { body =>
          val vec = body.hcursor.downField("universalInputSpace").as[Vector[Double]].getOrElse(Vector.empty)
          complete(engine.getDiagnosticMapping(vec))
        } } },

        // Perceive (Perception Engine push endpoint)
        path("perceive") { post { entity(as[Json]) { body =>
          val vec      = body.hcursor.downField("vector").as[Vector[Double]].getOrElse(Vector.empty)
          val matchOvr = body.hcursor.get[String]("matchAlgorithmOverride").toOption.map(ComparatorType.fromString)
          val step     = simulator.processImmediate(vec, matchOvr)
          // Sync PreceptionEngine's space with post-merge state
          engine.preceptionEngine.getPerceptualSpace.setPerceptualVector(step.perceptualSpace)
          complete(step.asJson)
        } } },

        // Root
        pathEndOrSingleSlash { get { complete(Json.obj(
          "name"    -> Json.fromString("Reality Engine"),
          "version" -> Json.fromString("1.0.0"),
          "status"  -> Json.fromString("running")
        )) } }
      )
    }
  } }
}
