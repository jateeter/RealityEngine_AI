package com.realityengine.perception

import akka.actor.ActorSystem
import akka.http.scaladsl.{ConnectionContext, Http}
import akka.stream.Materializer
import com.realityengine.perception.api.{PerceptionRoutes, WsBroadcastActor}
import com.realityengine.perception.logging.{AuditConfig, AuditLogger}
import com.realityengine.perception.engine.PerceptionEngine
import com.realityengine.perception.store.SourceStore

import java.io.{File, FileInputStream}
import java.security.{KeyStore, SecureRandom}
import java.security.cert.CertificateFactory
import javax.net.ssl.{KeyManagerFactory, SSLContext, TrustManagerFactory}
import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext}
import scala.util.{Failure, Success}

object PerceptionMain extends App {
  implicit val system: ActorSystem  = ActorSystem("perception-engine")
  implicit val mat: Materializer    = Materializer(system)
  implicit val ec: ExecutionContext  = system.dispatcher

  val port               = sys.env.getOrElse("PORT", "3004").toIntOption.getOrElse(3004)
  val host               = sys.env.getOrElse("HOST", "0.0.0.0")
  val perceptionTarget   = sys.env.getOrElse("PERCEPTION_TARGET_URL", "https://localhost:3001")
  val realityEngineUrl   = sys.env.getOrElse("REALITY_ENGINE_URL",   "https://localhost:3000")
  val dataPath           = sys.env.getOrElse("DATA_PATH", "./data")

  val auditCfg = AuditConfig.fromEnv("perception-engine")

  println("Starting Perception Engine (Scala/Akka)...")
  AuditLogger.logEvent(auditCfg, "startup", Map(
    "audit_enabled" -> io.circe.Json.fromBoolean(auditCfg.enabled),
    "audit_level"   -> io.circe.Json.fromInt(auditCfg.level),
  ))

  // ── TLS setup ─────────────────────────────────────────────────────────────
  // When KEYSTORE_PATH and CA_CERT_PATH are set, build a custom SSLContext
  // that (a) presents our cert to inbound connections and (b) trusts our CA
  // for all outgoing HTTPS calls (Reality Engine, visualizer notify, etc.).
  val keystorePath     = sys.env.getOrElse("KEYSTORE_PATH", "")
  val keystorePassword = sys.env.getOrElse("KEYSTORE_PASSWORD", "").toCharArray
  val caCertPath       = sys.env.getOrElse("CA_CERT_PATH", "")

  val tlsEnabled = keystorePath.nonEmpty && new File(keystorePath).exists() &&
                   caCertPath.nonEmpty   && new File(caCertPath).exists()

  val sslContext: Option[SSLContext] =
    if (tlsEnabled) Some(buildSslContext(keystorePath, keystorePassword, caCertPath))
    else None

  // Set as JVM-wide default so sttp's HttpURLConnectionBackend trusts our CA
  // for all outgoing HTTPS calls (Reality Engine, visualizer notify, etc.).
  sslContext.foreach(SSLContext.setDefault)

  // ── Engine bootstrap ──────────────────────────────────────────────────────

  val store   = new SourceStore(dataPath)
  val engine  = new PerceptionEngine

  val loaded = store.load()
  loaded.foreach(engine.restoreSource)
  println(s"[SourceStore] Loaded ${loaded.size} source(s) from $dataPath")

  val broadcastActor = system.actorOf(WsBroadcastActor.props(), "ws-broadcast")

  val routes = new PerceptionRoutes(
    engine              = engine,
    store               = store,
    broadcastActor      = broadcastActor,
    perceptionTargetUrl = perceptionTarget,
    realityEngineUrl    = realityEngineUrl,
    auditCfg            = auditCfg,
  )

  val serverAt = Http().newServerAt(host, port)
  val binding  = sslContext match {
    case Some(ctx) =>
      println(s"✓ TLS enabled (keystore: $keystorePath)")
      serverAt.enableHttps(ConnectionContext.httpsServer(ctx)).bind(routes.routes)
    case None =>
      println("  TLS not configured — binding plain HTTP")
      serverAt.bind(routes.routes)
  }

  binding.onComplete {
    case Failure(e) =>
      println(s"Failed to bind to $host:$port — ${e.getMessage}")
      system.terminate()
    case Success(b) =>
      val scheme = if (tlsEnabled) "https" else "http"
      println(s"\n✅ Perception Engine running on $scheme://$host:$port")
      println(s"   Push target    : $perceptionTarget/api/perceive")
      println(s"   Reality Engine : $realityEngineUrl")

      sys.addShutdownHook {
        println("\nShutting down gracefully...")
        Await.result(b.unbind(), 10.seconds)
        Await.result(system.terminate(), 10.seconds)
        println("✓ Shutdown complete")
      }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  def buildSslContext(
    keystorePath: String,
    password: Array[Char],
    caCertPath: String,
  ): SSLContext = {
    // Key material — server cert + private key from PKCS12 keystore
    val ks = KeyStore.getInstance("PKCS12")
    ks.load(new FileInputStream(keystorePath), password)
    val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm)
    kmf.init(ks, password)

    // Trust material — CA cert loaded from PEM; no keytool required
    val caCert = CertificateFactory.getInstance("X.509")
      .generateCertificate(new FileInputStream(caCertPath))
    val ts = KeyStore.getInstance(KeyStore.getDefaultType)
    ts.load(null, null)
    ts.setCertificateEntry("ca", caCert)
    val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm)
    tmf.init(ts)

    val ctx = SSLContext.getInstance("TLS")
    ctx.init(kmf.getKeyManagers, tmf.getTrustManagers, new SecureRandom())
    ctx
  }
}
