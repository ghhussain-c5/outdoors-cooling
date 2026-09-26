# Muharraq Climate Lab

A responsive HTML, CSS and JavaScript concept simulator for a solar canopy and outdoor DX cooling system in a Muharraq calisthenics zone. No build tools, package installation, API keys, CDNs or backend are required.

## Open it

Extract the ZIP and double-click `index.html`. Keep the other files and the `assets` folder beside it. The separate `Muharraq_Climate_Lab.html` delivery is a self-contained edition for easy sharing and opening offline.

## Publish with GitHub Pages

1. Create a public repository, for example `muharraq-climate-lab`.
2. Upload the **contents** of this folder. `index.html` must be at the repository root, alongside `styles.css`, `data.js`, `engine.js`, `scene.js`, `app.js`, and `assets/`. Do not upload only the ZIP.
3. Open **Settings → Pages → Build and deployment**.
4. Select **Deploy from a branch**, then **main**, then **/(root)**, and save.
5. Wait for GitHub's Pages deployment to finish. The Pages settings will show the live link.

All file references are relative, so project URLs such as `https://YOUR-USERNAME.github.io/muharraq-climate-lab/` work without changing the code.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

This package has not been published to your GitHub account.

## Use the simulator

- Move the time slider or press Play to animate the day. Solar geometry, shadows, PV output, weather, DX operation and condensate update together.
- Click a solar module, DX object, inverter, or the labeled equipment buttons to open the corresponding controls at the right. On a phone, the inspector is below the model.
- Click the weather chip for Bahrain reference periods, manual temperature/RH, occupant-level wind, direction and atmospheric solar factor.
- Change canopy height, strips, tilt and quantity. Only physically fitted modules are counted in electricity and cost.
- Select **Air temperature**, then **Plan**, and optionally hide the canopy to inspect the cooling footprint. Hover or tap the ground to probe air temperature and RH.
- The **Energy & water** view shows daily totals, schedule, coil balances and electrical current.
- The **Economics** view contains editable rates, itemized CAPEX and OPEX, first-year cost and lifecycle totals.
- **Export CSV** downloads the current inputs, calculated outputs, costs and source links.

## Engineering interpretation

This is a concept-comparison tool. It is not a validated CFD, structural, electrical or procurement design.

### Geometry

The supplied drawing does not define north, all bearings or curvature. One provisional seven-edge polygon is fitted to approximately transcribed lengths. Its default area is about 391.0 m². Curved edges are treated as chords. This is **not** a verified area measurement. Width/depth controls rescale the outline; six exercise stations and tree positions are schematic. Five trees are a default assumption; the supplied height is approximately 4 m.

### Weather and solar

The automatic weather curves are synthetic representative days based on **Bahrain Meteorological Directorate** reports for September 2024, July 2025 and January 2025. They interpolate mean daily extrema. They are not live or observed hourly weather and do not exactly reproduce monthly means. The representative date is the 15th of each selected month. Manual overrides hold temperature and RH constant through that day's calculation.

The Muharraq location is approximately 26.257°N, 50.611°E, UTC+3. Sun position uses approximate NOAA equations. Irradiance is an editable clear-sky envelope, not a measured solar dataset. PV uses nameplate output, tilt, simplified tree and row shading, an assumed 45°C NOCT, manufacturer temperature coefficient, soiling, 2% DC wiring loss, and inverter efficiency/clipping. Real string mismatch and bypass diodes need detailed electrical modeling. No bifacial rear gain is assumed.

Ground shadows are sampled on a 0.6 m grid and clipped to the site. The union is counted once. Canopy height changes displacement, not module area.

### Cooling

The coil uses a capacity-limited moist-air enthalpy and humidity-ratio balance. Apparatus dew point, minimum bypass and high-ambient corrections are editable study assumptions. Actual equipment selection must use manufacturer performance at **100% outdoor entering air** and the actual condenser ambient. Published gross/max capacities are used; no unverified fan-heat correction is applied. FRAL's high-ambient performance is not verified.

The 2D map solves a steady passive-scalar advection/diffusion equation using an upwind finite-volume grid and prescribed wind/outlet jets. It does not solve momentum, buoyancy, obstacle blockage, turbulence, surface thermal storage, occupants or full CFD. Its temperature is an occupied-layer mixture, not the nozzle discharge temperature. Absolute temperatures depend strongly on the assumed mixing coefficients and wind. The visual airflow particles are qualitative direction cues, not particle-resolved CFD trajectories.

Shade lowers radiant exposure. The displayed shortwave MRT reduction must **not** be added to the DX air-temperature drop or described as an air-temperature/UTCI reduction. Condenser heat is assumed fully rejected away from the modeled zone. Heavy DX equipment is placed on a pad at or away from pillar bases; pillar outlets are schematic duct connections.

Condensate is calculated from dry-air mass flow times inlet-minus-outlet humidity ratio, with density approximated at 1 kg/L. Reported recovery assumes all coil condensate is collected, with no evaporative or drain losses. It is not a measurement or a potable-water claim.

### Electricity and economics

The correct DC-to-AC component is an **inverter**. No battery is modeled. Grid assist imports deficits. Solar-following mode stages whole DX units according to available PV, but still assumes an active grid reference; it does not simulate off-grid startup or transients. Units stop outside the schedule, below 24°C or above a published ambient limit. Aggregate 400 V three-phase current is a calculation, not a cable/phase/string design.

Most prices are explicitly **planning allowances** requiring Bahrain quotations. Deye's BHD 605 is an advertised regional reference; shipping and VAT must be confirmed. The catalogs identify local Bahrain inquiry routes or regional suppliers delivering to Bahrain, not confirmed stock of exact models. Current supply revisions may differ.

CAPEX includes modules, height-sensitive canopy steel, foundations, DX units, inverters, installation, wiring/protection, drainage, engineering, freight, contingency and tax allowances. OPEX includes electricity, inspection, DX/inverter service and cleaning. Annualized costs repeat the selected day for the chosen number of days; they are not weather-year forecasts. Export credit defaults to zero. EWA's commercial electricity bands are referenced, while the user selects the site's applicable marginal tariff. One inverter replacement is included at year 12 within the study horizon; future DX renewal and residual values are not modeled.

## Files and customization

| File | Purpose |
| --- | --- |
| `index.html` | Accessible page structure and method notes |
| `styles.css` | Responsive layout and visual design |
| `data.js` | Published equipment ratings, suppliers, weather summaries and sources |
| `engine.js` | Geometry, solar, psychrometrics, transport and economics |
| `scene.js` | Interactive orthographic canvas model |
| `app.js` | Controls, linked updates, charts, tables and CSV export |
| `assets/site-sketch.png` | Your original boundary sketch |

To add equipment, add an entry to the appropriate array in `data.js`, keeping the field names and units consistent. To replace the provisional site, edit the `base` vertex coordinates in `engine.js` and the matching reference width/depth; then update the source/geometry notes.

Data and supplier links were checked on 26 September 2026. The in-app **Model & sources** view is the full source register.
