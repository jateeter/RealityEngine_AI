package com.realityengine

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Route
import com.realityengine.api.Routes
import com.realityengine.engine.{PerceptualSpaceSimulator, RealityEngine}
import com.realityengine.services.VectorStore
import sttp.client3.HttpURLConnectionBackend

import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext}
import scala.util.{Failure, Success}

object Main extends App {
  implicit val system: ActorSystem    = ActorSystem("reality-engine")
  implicit val ec: ExecutionContext   = system.dispatcher

  val port    = sys.env.getOrElse("PORT", "3000").toIntOption.getOrElse(3000)
  val host    = sys.env.getOrElse("HOST", "0.0.0.0")

  println("Starting Reality Engine (Scala/Akka)...")

  // Blocking sttp backend for Qdrant REST calls (runs on blocking-io-dispatcher)
  implicit val sttpBackend = HttpURLConnectionBackend()

  val vectorStore  = new VectorStore()
  val engine       = new RealityEngine(vectorStore)
  val simulator    = new PerceptualSpaceSimulator(256)

  // Sync simulator's evolved perceptual space back into PreceptionEngine after every step
  simulator.setOnStepComplete { (_, spaceVector) =>
    engine.preceptionEngine.getPerceptualSpace.setPerceptualVector(spaceVector)
  }

  // Initialize VectorStore, then start HTTP server
  val startup = for {
    _ <- vectorStore.initialize()
    _ <- engine.initialize()
  } yield ()

  startup.onComplete {
    case Failure(e) =>
      println(s"Failed to initialize: ${e.getMessage}")
      system.terminate()
    case Success(_) =>
      println("✓ Vector store initialized")
      println("✓ Reality Engine initialized")

      val routes = new Routes(engine, simulator)
      routes.loadDefaultMachines()

      Http().newServerAt(host, port).bind(routes.routes).onComplete {
        case Failure(e) =>
          println(s"Failed to bind to $host:$port: ${e.getMessage}")
          system.terminate()
        case Success(binding) =>
          println(s"\n✅ Reality Engine running on http://$host:$port")
          println(s"🗄️  Qdrant URL: ${sys.env.getOrElse("QDRANT_URL", "http://localhost:6333")}")

          sys.addShutdownHook {
            println("\nShutting down gracefully...")
            Await.result(binding.unbind(), 10.seconds)
            Await.result(system.terminate(), 10.seconds)
            println("✓ Shutdown complete")
          }
      }
  }
}
