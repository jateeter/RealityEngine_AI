# Agriculture Interconnections

The agriculture example corpus uses perceptual-space overlaps to turn individual
machines into operational and predictive management chains.

## Intent

The agriculture domain should not behave as a set of isolated monitors. Upstream
machines that detect operational conditions should feed downstream machines that
predict risk, optimize timing, or schedule preventive work.

The AGX aquaculture and indoor grow-house machines therefore use 4D output
signals as 4D downstream inputs where one operational signal directly improves a
later management decision.

## Current Matrix

The agriculture domain has:

- `59` active machines.
- `36` output-to-input overlaps inside the agriculture domain.
- `28` AGX predictive-management interconnections.

## Aquaculture Chains

Key predictive paths:

- Water quality stability -> biofilter health -> ammonia/nitrite risk ->
  aquaponic nutrient coupling.
- Recirculation pump reliability -> dissolved oxygen control -> pond turnover
  prevention.
- Quarantine biosecurity -> fish health surveillance -> hatchery/nursery
  transition, harvest readiness, and probiotic treatment tracking.
- Feeding efficiency -> solids removal -> water exchange planning -> effluent
  compliance.
- Stocking density -> animal welfare response.
- Hatchery/nursery transition -> larval survival optimization.

These links let the domain detect compound risk earlier: water chemistry,
circulation, stocking, feeding, and biosecurity outputs become direct predictors
for downstream health, welfare, compliance, and harvest decisions.

## Indoor Grow-House Chains

Key predictive paths:

- VPD climate management -> airflow circulation.
- Lighting schedule integrity -> crop steering -> canopy height control.
- Nutrient reservoir balance -> fertigation recipe verification -> tissue test
  response.
- Irrigation line maintenance -> root-zone oxygenation and drainage wastewater
  capture.
- Integrated pest management -> sanitation turnover and beneficial insect
  release.
- HVAC preventive maintenance -> dehumidifier reliability and energy demand
  response.
- Sensor calibration program -> facility alarm triage.
- Harvest labor coordination -> postharvest cold chain.

These links bias the grow-house domain toward predictive maintenance and
operational optimization: climate, fertigation, irrigation, IPM, HVAC, and
sensor-calibration signals drive the machines that should plan corrective action
before production loss appears.

## Maintenance Rule

When AGX machines are regenerated, run:

```bash
python3 scripts/generate_agriculture_aquaculture_growhouse_machines.py
node scripts/repack_machine_connection_matrix.mjs
```

The repack step removes unused coordinate positions while preserving the
intended output-to-input overlap topology.
