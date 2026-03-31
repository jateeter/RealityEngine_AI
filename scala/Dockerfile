# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM sbtscala/scala-sbt:eclipse-temurin-jammy-17.0.5_8_1.9.9_2.13.14 AS build

WORKDIR /app

# Cache sbt dependencies by copying build files first
COPY project/ project/
COPY build.sbt ./

# Pre-fetch dependencies
RUN sbt update

# Copy source and assemble fat JAR
COPY src/ src/
RUN sbt assembly

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Copy the fat JAR from the build stage
COPY --from=build /app/target/scala-2.13/reality-engine.jar ./reality-engine.jar

# Copy machine JSON examples (MachineLoader reads from examples/machines/)
COPY ../examples ./examples

EXPOSE 3000

ENV PORT=3000 \
    QDRANT_URL=http://qdrant:6333 \
    COLLECTION_NAME=reality-vectors \
    VECTOR_DIMENSION=256 \
    MACHINES_DIR=/app/examples/machines

CMD ["java", "-jar", "/app/reality-engine.jar"]
