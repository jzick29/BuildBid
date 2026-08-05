/**
 * Supplier Catalog — pre-seeded pricing database for BuildBid.
 * 
 * Architecture: This module acts as a pluggable supplier backend. Currently backed by
 * static data, but the function signatures are designed for drop-in replacement with
 * real supplier APIs (Home Depot, Grainger, Ferguson, etc.). To swap: implement the same
 * `getCatalogForTrade` / `searchCatalog` signatures against a real API and replace the import.
 *
 * Each item has a realistic SKU so estimators and purchase orders match real-world
 * product numbers. Pricing is 2026-appropriate.
 */

export interface CatalogItem {
  sku: string;
  name: string;
  description: string;
  unit: string;
  unit_cost: number;
  trade: string;
  supplier: string;
}

// ─── TRADE-SPECIFIC CATALOGS ───────────────────────────────────────────────

const ELECTRICAL_ITEMS: CatalogItem[] = [
  // Wire & Cable
  { sku: "28827428", name: "12/2 NM-B Romex Wire (per ft)", description: "12 AWG, 2 conductor with ground, yellow jacket, 600V", unit: "ft", unit_cost: 0.85, trade: "Electrical", supplier: "Southwire" },
  { sku: "28827455", name: "14/2 NM-B Romex Wire (per ft)", description: "14 AWG, 2 conductor with ground, white jacket, 600V", unit: "ft", unit_cost: 0.62, trade: "Electrical", supplier: "Southwire" },
  { sku: "28827469", name: "10/2 NM-B Romex Wire (per ft)", description: "10 AWG, 2 conductor with ground, orange jacket, 600V", unit: "ft", unit_cost: 1.45, trade: "Electrical", supplier: "Southwire" },
  { sku: "28827480", name: "12/3 NM-B Romex Wire (per ft)", description: "12 AWG, 3 conductor with ground, black jacket", unit: "ft", unit_cost: 1.35, trade: "Electrical", supplier: "Southwire" },
  { sku: "28827501", name: "8/2 NM-B Romex Wire (per ft)", description: "8 AWG, 2 conductor with ground, 600V", unit: "ft", unit_cost: 2.75, trade: "Electrical", supplier: "Southwire" },
  { sku: "28827512", name: "6/2 NM-B Romex Wire (per ft)", description: "6 AWG, 2 conductor with ground, 600V", unit: "ft", unit_cost: 4.20, trade: "Electrical", supplier: "Southwire" },
  { sku: "204792722", name: "THHN 12 AWG Stranded (per ft)", description: "12 AWG stranded THHN, single conductor, black", unit: "ft", unit_cost: 0.35, trade: "Electrical", supplier: "Southwire" },
  { sku: "204792738", name: "THHN 10 AWG Stranded (per ft)", description: "10 AWG stranded THHN, single conductor, black", unit: "ft", unit_cost: 0.55, trade: "Electrical", supplier: "Southwire" },
  { sku: "2CAG4", name: "2/0 Copper SER Cable (per ft)", description: "2/0-2/0-2/0-1 AWG, service entrance cable", unit: "ft", unit_cost: 8.95, trade: "Electrical", supplier: "Southwire" },

  // Breakers & Panels
  { sku: "1001836936", name: "Square D Homeline 200A Main Breaker Panel", description: "30-space, 60-circuit, indoor, NEMA 1, 120/240V", unit: "each", unit_cost: 185.00, trade: "Electrical", supplier: "Square D" },
  { sku: "1001836953", name: "Square D Homeline 100A Main Breaker Panel", description: "20-space, 40-circuit, indoor, NEMA 1", unit: "each", unit_cost: 98.00, trade: "Electrical", supplier: "Square D" },
  { sku: "1001139629", name: "Square D QO 200A 42-Space Panel", description: "Plug-on neutral, indoor, NEMA 1", unit: "each", unit_cost: 295.00, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM115PCAFIC", name: "Square D 15A AFCI Breaker", description: "Homeline dual-function arc fault, pigtail", unit: "each", unit_cost: 48.50, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM120PCAFIC", name: "Square D 20A AFCI Breaker", description: "Homeline dual-function arc fault, pigtail", unit: "each", unit_cost: 49.50, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM115PDFC", name: "Square D 15A GFCI Breaker", description: "Homeline dual-function GFCI", unit: "each", unit_cost: 54.00, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM120PDFC", name: "Square D 20A GFCI Breaker", description: "Homeline dual-function GFCI", unit: "each", unit_cost: 55.00, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM115", name: "Square D 15A Single-Pole Breaker", description: "Homeline standard breaker", unit: "each", unit_cost: 6.50, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM120", name: "Square D 20A Single-Pole Breaker", description: "Homeline standard breaker", unit: "each", unit_cost: 6.50, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM230", name: "Square D 30A Double-Pole Breaker", description: "Homeline 2-pole 240V", unit: "each", unit_cost: 15.50, trade: "Electrical", supplier: "Square D" },
  { sku: "HOM250", name: "Square D 50A Double-Pole Breaker", description: "Homeline 2-pole 240V", unit: "each", unit_cost: 16.50, trade: "Electrical", supplier: "Square D" },

  // Outlets & Switches
  { sku: "R26-5325-WCP", name: "Leviton 15A Duplex Outlet", description: "Standard tamper-resistant duplex, white", unit: "each", unit_cost: 1.89, trade: "Electrical", supplier: "Leviton" },
  { sku: "R26-T5320-W", name: "Leviton 15A Tamper-Resistant Outlet", description: "Slim profile, side-wire, white", unit: "each", unit_cost: 2.25, trade: "Electrical", supplier: "Leviton" },
  { sku: "GFTR1-W", name: "Leviton 15A GFCI Outlet", description: "Self-test slim GFCI, white", unit: "each", unit_cost: 14.97, trade: "Electrical", supplier: "Leviton" },
  { sku: "R02-D2155-0BE", name: "Leviton Decora Single-Pole Switch", description: "Rocker, 15A 120V, white", unit: "each", unit_cost: 2.49, trade: "Electrical", supplier: "Leviton" },
  { sku: "R02-D5603-2W", name: "Leviton Decora 3-Way Switch", description: "Rocker, 15A 120V, white", unit: "each", unit_cost: 4.49, trade: "Electrical", supplier: "Leviton" },
  { sku: "R52-06674-0WS", name: "Leviton 15A Dimmer Switch", description: "LED/CFL/Incandescent universal dimmer", unit: "each", unit_cost: 22.97, trade: "Electrical", supplier: "Leviton" },
  { sku: "IPV15-1LZ", name: "Lutron Caseta Smart Switch", description: "Wireless, 15A single-pole/3-way, white", unit: "each", unit_cost: 59.95, trade: "Electrical", supplier: "Lutron" },
  { sku: "80611-W", name: "Single Gang Old Work Box", description: "PVC cut-in box, 14 cu in", unit: "each", unit_cost: 1.29, trade: "Electrical", supplier: "Carlon" },
  { sku: "80612-W", name: "Double Gang Old Work Box", description: "PVC cut-in box, 28 cu in", unit: "each", unit_cost: 1.89, trade: "Electrical", supplier: "Carlon" },
  { sku: "B120A-W", name: "Single Gang New Work Box", description: "PVC nail-on box, 20 cu in", unit: "each", unit_cost: 0.79, trade: "Electrical", supplier: "Carlon" },

  // Fixtures & Recessed
  { sku: "WF6-W27K", name: "Halo 6\" LED Recessed Retrofit", description: "2700K, 90 CRI, dimmable, wet-location", unit: "each", unit_cost: 18.97, trade: "Electrical", supplier: "Halo" },
  { sku: "RL6-10PK-SW", name: "Halo 6\" LED New Construction Housing", description: "IC-rated airtight, 120V, 10-pack", unit: "each", unit_cost: 11.50, trade: "Electrical", supplier: "Halo" },
  { sku: "55392", name: "4' LED Wraparound Shop Light", description: "4000K, 4000 lumens, linkable, white", unit: "each", unit_cost: 39.97, trade: "Electrical", supplier: "Lithonia" },
  { sku: "FMFL30840", name: "4' LED Flush Mount Strip", description: "4000K, 3200 lumens, garage/utility", unit: "each", unit_cost: 24.98, trade: "Electrical", supplier: "Lithonia" },
  { sku: "756646", name: "Motion Sensor Flood Light LED", description: "Dual-head, 2400 lumens, bronze", unit: "each", unit_cost: 29.97, trade: "Electrical", supplier: "Hampton Bay" },
  { sku: "1004684448", name: "52-Inch Ceiling Fan with LED", description: "Brushed nickel, remote, 3-blade", unit: "each", unit_cost: 129.00, trade: "Electrical", supplier: "Hunter" },

  // Conduit & Fittings
  { sku: "S404CT10", name: "3/4\" EMT Conduit 10ft", description: "Steel, galvanized", unit: "each", unit_cost: 9.78, trade: "Electrical", supplier: "Allied" },
  { sku: "S405CT10", name: "1/2\" EMT Conduit 10ft", description: "Steel, galvanized", unit: "each", unit_cost: 7.48, trade: "Electrical", supplier: "Allied" },
  { sku: "BLB50", name: "1/2\" EMT Set-Screw Connector", description: "Zinc die-cast, box of 50", unit: "box", unit_cost: 24.68, trade: "Electrical", supplier: "Bridgeport" },
  { sku: "BLB51", name: "3/4\" EMT Set-Screw Connector", description: "Zinc die-cast, box of 50", unit: "box", unit_cost: 28.90, trade: "Electrical", supplier: "Bridgeport" },
  { sku: "96140", name: "1/2\" Romex Connector Box (100-pk)", description: "Snap-in, non-metallic, for NM cable", unit: "box", unit_cost: 15.98, trade: "Electrical", supplier: "Arlington" },

  // Misc
  { sku: "CT-AR-BK", name: "Wire Stapler Tacker", description: "Arrow T59 cable staple gun", unit: "each", unit_cost: 32.97, trade: "Electrical", supplier: "Arrow" },
  { sku: "1105", name: "Plastic Electrical Tape (7-mil)", description: "Black 3/4\" x 66ft, 10-pack", unit: "pack", unit_cost: 14.98, trade: "Electrical", supplier: "3M" },
  { sku: "614689", name: "Ground Rod 5/8\" x 8ft", description: "Copper-bonded steel", unit: "each", unit_cost: 19.98, trade: "Electrical", supplier: "Erico" },
  { sku: "614690", name: "Ground Rod Clamp 5/8\"", description: "Bronze, direct burial", unit: "each", unit_cost: 4.78, trade: "Electrical", supplier: "Erico" },
  { sku: "1005073057", name: "Whole-House Surge Protector", description: "Type 2, 80kA, NEMA 4X outdoor rated", unit: "each", unit_cost: 129.00, trade: "Electrical", supplier: "Square D" },
  { sku: "205441032", name: "4/0-4/0-4/0-2/0 AL SER Cable (per ft)", description: "Aluminum service entrance, 200A rated", unit: "ft", unit_cost: 3.85, trade: "Electrical", supplier: "Southwire" },
  { sku: "204792294", name: "14/2 UF-B Underground (per ft)", description: "Direct burial, gray jacket", unit: "ft", unit_cost: 0.72, trade: "Electrical", supplier: "Southwire" },
  { sku: "204792300", name: "12/2 UF-B Underground (per ft)", description: "Direct burial, gray jacket", unit: "ft", unit_cost: 0.98, trade: "Electrical", supplier: "Southwire" },
];

const PLUMBING_ITEMS: CatalogItem[] = [
  // Pipe & Tubing
  { sku: "1010112", name: "1/2\" Type L Copper Pipe 10ft", description: "Rigid, ASTM B88, for potable water", unit: "stick", unit_cost: 28.47, trade: "Plumbing", supplier: "Mueller" },
  { sku: "1010118", name: "3/4\" Type L Copper Pipe 10ft", description: "Rigid, ASTM B88", unit: "stick", unit_cost: 38.95, trade: "Plumbing", supplier: "Mueller" },
  { sku: "1010125", name: "1\" Type L Copper Pipe 10ft", description: "Rigid, ASTM B88", unit: "stick", unit_cost: 52.88, trade: "Plumbing", supplier: "Mueller" },
  { sku: "C6312C", name: "1/2\" PEX-A Tubing 100ft", description: "Uponor AquaPEX, red, non-barrier", unit: "roll", unit_cost: 49.00, trade: "Plumbing", supplier: "Uponor" },
  { sku: "C6313C", name: "3/4\" PEX-A Tubing 100ft", description: "Uponor AquaPEX, red, non-barrier", unit: "roll", unit_cost: 72.00, trade: "Plumbing", supplier: "Uponor" },
  { sku: "73923", name: "1/2\" x 300ft PEX-B Tubing", description: "SharkBite PEX-B, blue, 300ft roll", unit: "roll", unit_cost: 59.00, trade: "Plumbing", supplier: "SharkBite" },
  { sku: "23970LF", name: "1-1/2\" PVC Sch 40 Pipe 10ft", description: "DWV and pressure rated, white", unit: "stick", unit_cost: 14.97, trade: "Plumbing", supplier: "Charlotte Pipe" },
  { sku: "23971LF", name: "2\" PVC Sch 40 Pipe 10ft", description: "DWV and pressure rated, white", unit: "stick", unit_cost: 19.97, trade: "Plumbing", supplier: "Charlotte Pipe" },
  { sku: "23974LF", name: "3\" PVC Sch 40 Pipe 10ft", description: "DWV and pressure rated, white", unit: "stick", unit_cost: 32.88, trade: "Plumbing", supplier: "Charlotte Pipe" },
  { sku: "23976LF", name: "4\" PVC Sch 40 Pipe 10ft", description: "DWV and pressure rated, white", unit: "stick", unit_cost: 47.92, trade: "Plumbing", supplier: "Charlotte Pipe" },

  // Fittings
  { sku: "UC016LFA", name: "1/2\" Copper 90° Elbow", description: "Cup x cup, lead-free", unit: "each", unit_cost: 1.59, trade: "Plumbing", supplier: "Elkhart" },
  { sku: "UC017LFA", name: "3/4\" Copper 90° Elbow", description: "Cup x cup, lead-free", unit: "each", unit_cost: 2.19, trade: "Plumbing", supplier: "Elkhart" },
  { sku: "UC401LFA", name: "1/2\" Copper Tee", description: "Cup x cup x cup, lead-free", unit: "each", unit_cost: 2.79, trade: "Plumbing", supplier: "Elkhart" },
  { sku: "UC402LFA", name: "3/4\" Copper Tee", description: "Cup x cup x cup, lead-free", unit: "each", unit_cost: 3.89, trade: "Plumbing", supplier: "Elkhart" },
  { sku: "UC600LFA", name: "1/2\" Copper Coupling", description: "Cup x cup, lead-free", unit: "each", unit_cost: 0.89, trade: "Plumbing", supplier: "Elkhart" },
  { sku: "C4060100", name: "1/2\" PVC Sch 40 90° Elbow", description: "Slip x slip, white", unit: "each", unit_cost: 0.68, trade: "Plumbing", supplier: "Charlotte" },
  { sku: "C4801100", name: "1-1/2\" PVC Sch 40 Coupling", description: "Slip x slip, white", unit: "each", unit_cost: 1.28, trade: "Plumbing", supplier: "Charlotte" },
  { sku: "PVC034001200HA", name: "3\" PVC Sch 40 Wye", description: "H x H x H, white", unit: "each", unit_cost: 8.97, trade: "Plumbing", supplier: "Charlotte" },
  { sku: "UIP102", name: "1/2\" ProPEX Expansion Coupling", description: "Uponor lead-free brass, for PEX-A", unit: "each", unit_cost: 7.89, trade: "Plumbing", supplier: "Uponor" },
  { sku: "UIP402", name: "3/4\" ProPEX Expansion 90", description: "Uponor lead-free brass, for PEX-A", unit: "each", unit_cost: 10.49, trade: "Plumbing", supplier: "Uponor" },
  { sku: "UC248LF", name: "1/2\" Push-to-Connect 90° Elbow", description: "SharkBite, brass, lead-free", unit: "each", unit_cost: 8.48, trade: "Plumbing", supplier: "SharkBite" },
  { sku: "UC232LF", name: "1/2\" Push-to-Connect Tee", description: "SharkBite, brass, lead-free", unit: "each", unit_cost: 12.98, trade: "Plumbing", supplier: "SharkBite" },

  // Water Heaters
  { sku: "1001796468", name: "40 Gal Natural Gas Water Heater", description: "40k BTU, 0.62 UEF, 6-year tank warranty", unit: "each", unit_cost: 649.00, trade: "Plumbing", supplier: "Rheem" },
  { sku: "1001796215", name: "50 Gal Electric Water Heater", description: "4500W dual element, 0.93 UEF, 6-year tank warranty", unit: "each", unit_cost: 529.00, trade: "Plumbing", supplier: "Rheem" },
  { sku: "1002723167", name: "50 Gal Power Vent NG Water Heater", description: "50k BTU, 0.70 UEF, residential power-vent", unit: "each", unit_cost: 1,149.00, trade: "Plumbing", supplier: "Rheem" },
  { sku: "ECO27", name: "27kW Tankless Electric Water Heater", description: "240V, 3x40A, 2.9 GPM at 35°F rise", unit: "each", unit_cost: 489.00, trade: "Plumbing", supplier: "EcoSmart" },
  { sku: "GTS-540-NG", name: "Tankless NG Water Heater Indoor", description: "199k BTU, 9.8 GPM max, condensing", unit: "each", unit_cost: 1,695.00, trade: "Plumbing", supplier: "Takagi" },

  // Fixtures
  { sku: "22180-SR-CP", name: "Single-Handle Bathroom Faucet", description: "WaterSense, chrome, drain assembly included", unit: "each", unit_cost: 89.00, trade: "Plumbing", supplier: "Delta" },
  { sku: "9159-AR-DST", name: "Pull-Down Kitchen Faucet", description: "Spot resist stainless, 1.8 GPM, high arc", unit: "each", unit_cost: 219.00, trade: "Plumbing", supplier: "Delta" },
  { sku: "C43904-WH", name: "High-Efficiency Elongated Toilet", description: "1.28 GPF, comfort height, white, complete", unit: "each", unit_cost: 248.00, trade: "Plumbing", supplier: "American Standard" },
  { sku: "K-3810-0", name: "Cimarron Complete Toilet", description: "Chair height, 1.28 GPF, AquaPiston, white", unit: "each", unit_cost: 279.00, trade: "Plumbing", supplier: "Kohler" },
  { sku: "B8959-60-RWS", name: "60\" Alcove Bathtub Left-Drain", description: "Americast, slip-resistant, white", unit: "each", unit_cost: 389.00, trade: "Plumbing", supplier: "American Standard" },
  { sku: "202720-01-0", name: "60\" Shower Base", description: "Fiberglass-reinforced acrylic, white, center drain", unit: "each", unit_cost: 249.00, trade: "Plumbing", supplier: "Sterling" },
  { sku: "K-RP77380-CP", name: "Shower Trim Kit", description: "Pressure-balancing, single-handle, chrome", unit: "each", unit_cost: 119.00, trade: "Plumbing", supplier: "Kohler" },
  { sku: "R10000-UNBXHF", name: "Universal Shower Rough-In Valve", description: "1/2\" universal, brass, for PEX or copper", unit: "each", unit_cost: 98.00, trade: "Plumbing", supplier: "Delta" },
  { sku: "738", name: "1/2 HP Garbage Disposal", description: "Continuous feed, 2600 RPM, EZ-mount", unit: "each", unit_cost: 119.00, trade: "Plumbing", supplier: "InSinkErator" },
  { sku: "1000816333", name: "Dishwasher Install Kit", description: "Braided stainless, 3/8\" comp, 6ft, with power cord", unit: "each", unit_cost: 23.98, trade: "Plumbing", supplier: "Eastman" },

  // Valves
  { sku: "10733LF", name: "1/2\" Full-Port Ball Valve", description: "Brass, lever handle, solder ends, lead-free", unit: "each", unit_cost: 11.57, trade: "Plumbing", supplier: "Apollo" },
  { sku: "10734LF", name: "3/4\" Full-Port Ball Valve", description: "Brass, lever handle, solder ends, lead-free", unit: "each", unit_cost: 15.47, trade: "Plumbing", supplier: "Apollo" },
  { sku: "23036LF", name: "1/2\" Quarter-Turn Angle Stop", description: "Chrome-plated brass, 3/8\" OD comp outlet, lead-free", unit: "each", unit_cost: 8.87, trade: "Plumbing", supplier: "BrassCraft" },
  { sku: "3/4PRV", name: "3/4\" Pressure Reducing Valve", description: "Lead-free brass, 25-75psi adjustable, double-union", unit: "each", unit_cost: 89.00, trade: "Plumbing", supplier: "Watts" },

  // Misc
  { sku: "85745", name: "1/2\" x 5ft Toilet Supply Line", description: "Braided stainless, 3/8 comp x 7/8 BC", unit: "each", unit_cost: 5.47, trade: "Plumbing", supplier: "Fluidmaster" },
  { sku: "51000", name: "Toilet Wax Ring with Horn", description: "Jumbo, reinforced, for 3\" and 4\" waste lines", unit: "each", unit_cost: 6.98, trade: "Plumbing", supplier: "Oatey" },
  { sku: "30070", name: "Pipe Thread Sealant 4oz", description: "PTFE paste, -50°F to 500°F", unit: "each", unit_cost: 5.98, trade: "Plumbing", supplier: "Blue Monster" },
  { sku: "31230", name: "Lead-Free Solder 1/2 lb", description: "95/5 tin-antimony, 1/8\" diameter", unit: "each", unit_cost: 28.97, trade: "Plumbing", supplier: "Oatey" },
  { sku: "30132", name: "Water-Soluble Flux Paste 4oz", description: "Lead-free, NSF-listed, for potable water", unit: "each", unit_cost: 5.48, trade: "Plumbing", supplier: "Oatey" },
  { sku: "336538", name: "1/3 HP Sump Pump", description: "Submersible, 2,520 GPH, 10ft cord, piggyback switch", unit: "each", unit_cost: 149.00, trade: "Plumbing", supplier: "Wayne" },
];

const HVAC_ITEMS: CatalogItem[] = [
  // Equipment
  { sku: "4TTR4036L1000A", name: "3-Ton 14 SEER2 AC Condenser", description: "R-454B, single-stage, 208/230V single-phase", unit: "each", unit_cost: 2,495.00, trade: "HVAC", supplier: "Trane" },
  { sku: "4TTR4048L1000A", name: "4-Ton 14 SEER2 AC Condenser", description: "R-454B, single-stage, 208/230V single-phase", unit: "each", unit_cost: 2,895.00, trade: "HVAC", supplier: "Trane" },
  { sku: "4TTR4060L1000A", name: "5-Ton 14 SEER2 AC Condenser", description: "R-454B, single-stage, 208/230V single-phase", unit: "each", unit_cost: 3,295.00, trade: "HVAC", supplier: "Trane" },
  { sku: "4MXA2036A10N0A", name: "3-Ton 17 SEER2 AC Condenser", description: "R-454B, two-stage, variable-speed compatible", unit: "each", unit_cost: 3,895.00, trade: "HVAC", supplier: "Trane" },
  { sku: "GSZB403610", name: "3-Ton 14.3 SEER2 Heat Pump", description: "R-454B, single-stage, 208/230V", unit: "each", unit_cost: 3,095.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "GSZB404810", name: "4-Ton 14.3 SEER2 Heat Pump", description: "R-454B, single-stage, 208/230V", unit: "each", unit_cost: 3,495.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "CAPF3743C6", name: "3-Ton Cased Evaporator Coil", description: "Cased A-coil, TXV, for R-454B", unit: "each", unit_cost: 595.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "CAPF4860C6", name: "4-5 Ton Cased Evaporator Coil", description: "Cased A-coil, TXV, for R-454B", unit: "each", unit_cost: 695.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "GM9S800603AN", name: "60k BTU 80% Gas Furnace", description: "Single-stage, upflow/horizontal, 17.5\" wide", unit: "each", unit_cost: 1,095.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "GM9S800805CN", name: "80k BTU 80% Gas Furnace", description: "Single-stage, upflow/horizontal, 21\" wide", unit: "each", unit_cost: 1,195.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "GM9S801005CN", name: "100k BTU 80% Gas Furnace", description: "Single-stage, upflow/horizontal, 21\" wide", unit: "each", unit_cost: 1,395.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "GMVC960805CN", name: "80k BTU 96% Modulating Furnace", description: "Variable-speed ECM, ComfortBridge, 21\" wide", unit: "each", unit_cost: 2,295.00, trade: "HVAC", supplier: "Goodman" },
  { sku: "R801SA075417MSA", name: "75k BTU 80% Gas Furnace", description: "Upflow/horizontal, 17.5\" wide, aluminized HX", unit: "each", unit_cost: 995.00, trade: "HVAC", supplier: "Rheem" },

  // Mini-Splits
  { sku: "38MHRBQ24AA3", name: "24k BTU Ductless Mini-Split HP", description: "20.5 SEER, wireless remote, 208/230V", unit: "each", unit_cost: 1,649.00, trade: "HVAC", supplier: "Carrier" },
  { sku: "38MHRBQ36AA3", name: "36k BTU Ductless Mini-Split HP", description: "18 SEER, wireless remote, 208/230V", unit: "each", unit_cost: 2,349.00, trade: "HVAC", supplier: "Carrier" },
  { sku: "MSZ-FS12NA", name: "12k BTU Wall-Mount Mini-Split HP", description: "26.1 SEER, Energy Star, i-see sensor", unit: "each", unit_cost: 1,895.00, trade: "HVAC", supplier: "Mitsubishi" },

  // Ductwork & Ventilation
  { sku: "F6X300X25", name: "6\" x 25ft R-6 Flex Duct", description: "Insulated, Class 1 air connector, silver jacket", unit: "each", unit_cost: 34.97, trade: "HVAC", supplier: "Master Flow" },
  { sku: "F8X300X25", name: "8\" x 25ft R-6 Flex Duct", description: "Insulated, Class 1 air connector, silver jacket", unit: "each", unit_cost: 42.97, trade: "HVAC", supplier: "Master Flow" },
  { sku: "F10X300X25", name: "10\" x 25ft R-6 Flex Duct", description: "Insulated, Class 1 air connector, silver jacket", unit: "each", unit_cost: 52.97, trade: "HVAC", supplier: "Master Flow" },
  { sku: "RAD6", name: "6\" Round Damper", description: "Galvanized steel, manual locking quadrant", unit: "each", unit_cost: 8.97, trade: "HVAC", supplier: "Master Flow" },
  { sku: "RAD8", name: "8\" Round Damper", description: "Galvanized steel, manual locking quadrant", unit: "each", unit_cost: 10.97, trade: "HVAC", supplier: "Master Flow" },
  { sku: "SB06X04", name: "6\"x4\" Floor Register", description: "Steel, brown, opposed-blade damper", unit: "each", unit_cost: 14.97, trade: "HVAC", supplier: "Accord" },
  { sku: "BVC6", name: "6\" Round Ceiling Diffuser", description: "Steel, 2-cone, white, 1.33 spacing", unit: "each", unit_cost: 22.97, trade: "HVAC", supplier: "Trudef" },
  { sku: "GVL0120-6", name: "4\" x 12\" x 6ft Plenum Box", description: "Insulated, 26-gauge, fiberboard", unit: "each", unit_cost: 38.97, trade: "HVAC", supplier: "Duro Dyne" },
  { sku: "104001", name: "Metal Duct Sealant 1 Gal", description: "Water-based, UL181A/B-M, gray", unit: "each", unit_cost: 32.97, trade: "HVAC", supplier: "Hardcast" },

  // Thermostats & Controls
  { sku: "RTH9585WF", name: "WiFi Smart Thermostat", description: "Color touchscreen, Alexa, Humidity control", unit: "each", unit_cost: 179.00, trade: "HVAC", supplier: "Honeywell" },
  { sku: "THX321WFS2001W", name: "T10 Pro Smart Thermostat", description: "WiFi, dual-fuel ready, room sensors (sold sep)", unit: "each", unit_cost: 249.00, trade: "HVAC", supplier: "Honeywell" },
  { sku: "ECOBEE-3-LITE", name: "ecobee3 Lite Smart Thermostat", description: "WiFi, Energy Star, geofencing, remote sensors", unit: "each", unit_cost: 149.99, trade: "HVAC", supplier: "ecobee" },
  { sku: "NEST-LEARN4", name: "Nest Learning Thermostat 4th Gen", description: "Auto-schedule, Nest Renew, 6-wire support", unit: "each", unit_cost: 279.99, trade: "HVAC", supplier: "Google" },
  { sku: "C7735A1000", name: "Outdoor Temperature Sensor", description: "10k NTC thermistor, for dual-fuel and HP", unit: "each", unit_cost: 28.97, trade: "HVAC", supplier: "Honeywell" },

  // Installation Materials
  { sku: "ATCF608413", name: "3/8\" x 3/4\" x 50ft Lineset", description: "Pre-charged, insulated pair, R-454B", unit: "each", unit_cost: 189.00, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "ATCF608613", name: "3/8\" x 7/8\" x 50ft Lineset", description: "Pre-charged, insulated pair, R-454B", unit: "each", unit_cost: 219.00, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "NP120", name: "Condenser Pad 36\"x36\"", description: "Plastic, UV-stabilized, ribbed", unit: "each", unit_cost: 69.97, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "NP100", name: "Condenser Pad 30\"x30\"", description: "Plastic, UV-stabilized, ribbed", unit: "each", unit_cost: 54.97, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "885B", name: "Condenser Wall Bracket", description: "Powder-coated steel, 1000lb capacity, pair", unit: "pair", unit_cost: 89.97, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "6110106000", name: "3/4\" PVC Condensate Drain Line 10ft", description: "Sch 40, white, UV resistant", unit: "stick", unit_cost: 5.98, trade: "HVAC", supplier: "Charlotte" },
  { sku: "NS-324G", name: "4\" Filter Grille Return", description: "Steel, white, hinged face, 20x20 opening", unit: "each", unit_cost: 32.97, trade: "HVAC", supplier: "Hart & Cooley" },
  { sku: "LX-140", name: "20\"x25\"x4\" MERV 11 Filter", description: "Pleated, electrostatic, 4-pack", unit: "pack", unit_cost: 49.97, trade: "HVAC", supplier: "Lennox" },
  { sku: "DISC8X24", name: "Flex Duct Take-Off Collar 8\"", description: "Galvanized, 24-gauge, snap-lock, 8\" dia", unit: "each", unit_cost: 5.97, trade: "HVAC", supplier: "Southwark" },

  // Tools & Misc
  { sku: "BF-AF", name: "A/C Condensate Float Switch", description: "Overflow safety, NC, 24V, reversible", unit: "each", unit_cost: 19.97, trade: "HVAC", supplier: "DiversiTech" },
  { sku: "ASPF125", name: "Condensate Pump 115V", description: "2.6 gal tank, 20ft lift, 15ft tubing", unit: "each", unit_cost: 64.97, trade: "HVAC", supplier: "Little Giant" },
  { sku: "TSTAT-18-8", name: "18/8 Thermostat Wire 250ft", description: "Solid copper, CL2 rated, brown", unit: "roll", unit_cost: 89.97, trade: "HVAC", supplier: "Southwire" },
  { sku: "N2X", name: "Nylog Blue Sealant 30ml", description: "Gasket and thread sealant for AC/R", unit: "each", unit_cost: 11.97, trade: "HVAC", supplier: "Refrigeration Technologies" },
];

const ROOFING_ITEMS: CatalogItem[] = [
  // Shingles & Underlayment
  { sku: "671700", name: "Architectural Shingles (Bundle)", description: "33.3 sq ft, lifetime limited warranty, dimensional, 3 bundles/sq", unit: "bundle", unit_cost: 42.97, trade: "Roofing", supplier: "GAF" },
  { sku: "672700", name: "Timberline HDZ Bundle", description: "LayerLock, 33.3 sq ft, lifetime limited, 25 wind", unit: "bundle", unit_cost: 48.97, trade: "Roofing", supplier: "GAF" },
  { sku: "0201880", name: "Landmark PRO Bundle", description: "Max Def, 33.3 sq ft, highest algae resistance", unit: "bundle", unit_cost: 49.97, trade: "Roofing", supplier: "CertainTeed" },
  { sku: "030084", name: "Roofing Felt #30 (432 sq ft)", description: "ASTM D4869 Type 1, approx 2 squares", unit: "roll", unit_cost: 27.97, trade: "Roofing", supplier: "GAF" },
  { sku: "0280", name: "Deck-Armor Synthetic Underlayment 10 sq", description: "Breathable, 110-lb tear strength", unit: "roll", unit_cost: 69.97, trade: "Roofing", supplier: "GAF" },
  { sku: "SW2250000", name: "StormGuard Ice & Water Shield 200 sq ft", description: "Self-adhered, 36\" x 66.7ft, smooth surface", unit: "roll", unit_cost: 84.97, trade: "Roofing", supplier: "GAF" },
  { sku: "5680", name: "Tri-Flex Synthetic Underlayment 10 sq", description: "Ultra high-traction, 200-lb tear, 120-day exposure", unit: "roll", unit_cost: 89.97, trade: "Roofing", supplier: "Owens Corning" },

  // Metal Roofing
  { sku: "2315070", name: "Metal Roof Panel 3'x12' 26ga", description: "Galvalume plus, PBR panel", unit: "each", unit_cost: 57.97, trade: "Roofing", supplier: "Mueller" },
  { sku: "2315075", name: "Metal Roof Panel 3'x16' 26ga", description: "Galvalume plus, PBR panel", unit: "each", unit_cost: 77.97, trade: "Roofing", supplier: "Mueller" },
  { sku: "2315078", name: "Metal Roof Panel 3'x20' 26ga", description: "Galvalume plus, PBR panel", unit: "each", unit_cost: 97.97, trade: "Roofing", supplier: "Mueller" },
  { sku: "RPP-192", name: "Ridge Cap 10'x10.5\" 26ga", description: "Formed, matches PBR panels", unit: "each", unit_cost: 18.97, trade: "Roofing", supplier: "Mueller" },

  // Flashing & Vents
  { sku: "GBOP626", name: "Oatey 1-1/2\"-3\" Pipe Boot Flashing", description: "Neoprene, aluminum base, 26\" x 20\"", unit: "each", unit_cost: 23.97, trade: "Roofing", supplier: "Oatey" },
  { sku: "11832", name: "Step Flashing 10\"x10\" (50-pack)", description: "Galvanized 28-gauge, 10\"x10\"", unit: "box", unit_cost: 49.97, trade: "Roofing", supplier: "Gibraltar" },
  { sku: "750", name: "Roof Ridge Vent 20ft", description: "Mesh, ridge roll vent, 9\" wide", unit: "each", unit_cost: 54.97, trade: "Roofing", supplier: "GAF" },
  { sku: "BVR4", name: "Box/Gable Vent 18\"x24\"", description: "Aluminum, mill finish, 60 sq in NFA", unit: "each", unit_cost: 24.97, trade: "Roofing", supplier: "Air Vent" },
  { sku: "SHE8B", name: "Continuous Soffit Vent 16\"x8\"", description: "Aluminum, white, 56 NFA per piece", unit: "each", unit_cost: 7.97, trade: "Roofing", supplier: "Air Vent" },
  { sku: "3010", name: "Turbine Vent 12\"", description: "Wind-driven, aluminum, mill, 144 sq in NFA", unit: "each", unit_cost: 39.97, trade: "Roofing", supplier: "Lomanco" },
  { sku: "WHIRLY12B", name: "Whirlybird Turbine Vent 12\"", description: "External brace, riveted, adjustable pitch", unit: "each", unit_cost: 44.97, trade: "Roofing", supplier: "Lomanco" },

  // Gutters
  { sku: "K500HB10", name: "5\" K-Style Gutter 10ft", description: "Aluminum, .032\", white, pre-notched", unit: "stick", unit_cost: 14.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "85235BC", name: "5\" K-Style Gutter End Cap", description: "Aluminum, white, left", unit: "each", unit_cost: 3.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "85234BC", name: "5\" K-Style Inside Miter Box", description: "Aluminum, white, 90°", unit: "each", unit_cost: 12.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "5400140121", name: "5\" Drop Outlet", description: "Aluminum, white, 2\" round outlet", unit: "each", unit_cost: 6.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "RPK240W", name: "2\"x3\" Downspout 10ft", description: "Aluminum, .019\", white", unit: "stick", unit_cost: 12.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "T1502A", name: "Gutter Hanger 5\" (50-pack)", description: "Hidden, aluminum, white, with screws", unit: "box", unit_cost: 19.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "GLS202CN", name: "Gutter Sealant 10oz", description: "Butyl rubber, clear, 10.1oz cartridge", unit: "each", unit_cost: 8.97, trade: "Roofing", supplier: "GE" },

  // Fasteners & Accessories
  { sku: "1CNE1", name: "1-1/4\" Roofing Nails (3600-count)", description: "Electro-galvanized, smooth shank, 11-gauge", unit: "box", unit_cost: 34.97, trade: "Roofing", supplier: "Grip-Rite" },
  { sku: "GR112M", name: "1-1/4\" Roofing Nails (Coil)", description: "120-count coil for pneumatic, ring shank", unit: "coil", unit_cost: 15.97, trade: "Roofing", supplier: "Grip-Rite" },
  { sku: "71502", name: "1-1/4\" #8 Wood Screws (1000)", description: "Zinc-plated, for metal-to-wood, hex washer head", unit: "box", unit_cost: 28.97, trade: "Roofing", supplier: "Simpson" },
  { sku: "5012W", name: "Drip Edge 10ft", description: "Aluminum, white, 2\" face, hemmed", unit: "stick", unit_cost: 8.97, trade: "Roofing", supplier: "Amerimax" },
  { sku: "RE-15", name: "Roofing Cement 1 Gal", description: "Plastic roof cement, wet/dry, asbestos-free", unit: "each", unit_cost: 19.97, trade: "Roofing", supplier: "Black Jack" },
  { sku: "5497", name: "3-Tab Starter Strip Shingle Bundle", description: "36\" wide, adhesive-backed Dura Grip", unit: "bundle", unit_cost: 37.97, trade: "Roofing", supplier: "GAF" },
  { sku: "5498", name: "Hip & Ridge Cap Shingles Bundle", description: "High-profile, 36 linear ft coverage", unit: "bundle", unit_cost: 47.97, trade: "Roofing", supplier: "GAF" },
  { sku: "SW600", name: "Skylight 22\"x46\" Fixed", description: "Tempered, low-E3, curb-mounted, solar-powered blind ready", unit: "each", unit_cost: 419.00, trade: "Roofing", supplier: "Velux" },
  { sku: "SU600", name: "Skylight Flashing Kit", description: "For Velux fixed skylights, step flashing, 3:12-6:12", unit: "each", unit_cost: 129.00, trade: "Roofing", supplier: "Velux" },
];

const GC_ITEMS: CatalogItem[] = [
  // Framing Lumber
  { sku: "161640", name: "2x4x8 Kiln-Dried SPF Stud", description: "#2 and Better, kiln-dried, spruce-pine-fir", unit: "each", unit_cost: 3.97, trade: "General", supplier: "84 Lumber" },
  { sku: "161652", name: "2x4x10 Kiln-Dried SPF Stud", description: "#2 and Better, kiln-dried, spruce-pine-fir", unit: "each", unit_cost: 5.47, trade: "General", supplier: "84 Lumber" },
  { sku: "161675", name: "2x4x12 Kiln-Dried SPF Stud", description: "#2 and Better, kiln-dried, spruce-pine-fir", unit: "each", unit_cost: 6.47, trade: "General", supplier: "84 Lumber" },
  { sku: "162040", name: "2x6x8 Kiln-Dried SPF", description: "#2 and Better, kiln-dried", unit: "each", unit_cost: 6.97, trade: "General", supplier: "84 Lumber" },
  { sku: "162068", name: "2x6x12 Kiln-Dried SPF", description: "#2 and Better, kiln-dried", unit: "each", unit_cost: 10.97, trade: "General", supplier: "84 Lumber" },
  { sku: "162075", name: "2x8x12 Kiln-Dried SPF", description: "#2 and Better, kiln-dried", unit: "each", unit_cost: 14.97, trade: "General", supplier: "84 Lumber" },
  { sku: "162087", name: "2x10x12 Kiln-Dried SPF", description: "#2 and Better, kiln-dried", unit: "each", unit_cost: 19.97, trade: "General", supplier: "84 Lumber" },
  { sku: "162120", name: "2x12x12 Kiln-Dried SPF", description: "#2 and Better, kiln-dried", unit: "each", unit_cost: 24.97, trade: "General", supplier: "84 Lumber" },
  { sku: "112410", name: "4x4x8 Pressure-Treated Post", description: "Ground contact, #2, SYP", unit: "each", unit_cost: 14.97, trade: "General", supplier: "84 Lumber" },
  { sku: "112426", name: "4x4x12 Pressure-Treated Post", description: "Ground contact, #2, SYP", unit: "each", unit_cost: 22.97, trade: "General", supplier: "84 Lumber" },
  { sku: "112710", name: "6x6x8 Pressure-Treated Post", description: "Ground contact, #2, SYP", unit: "each", unit_cost: 32.97, trade: "General", supplier: "84 Lumber" },

  // Sheathing & Siding
  { sku: "12328", name: "7/16\" OSB Sheathing 4x8", description: "Exposure 1, tongue-and-groove edges", unit: "sheet", unit_cost: 19.97, trade: "General", supplier: "LP" },
  { sku: "12426", name: "3/4\" T&G OSB Subfloor 4x8", description: "Sturd-I-Floor, 23/32 actual, Exposure 1", unit: "sheet", unit_cost: 34.97, trade: "General", supplier: "Advantech" },
  { sku: "12223", name: "1/2\" CDX Plywood 4x8", description: "Exposure 1, 4-ply, exterior glue", unit: "sheet", unit_cost: 29.97, trade: "General", supplier: "Roseburg" },
  { sku: "12225", name: "3/4\" CDX Plywood 4x8", description: "Exposure 1, 5-ply, exterior glue", unit: "sheet", unit_cost: 42.97, trade: "General", supplier: "Roseburg" },
  { sku: "207345", name: "HardiePlank Lap Siding 12'x8.25\"", description: "Fiber cement, Cedarmill texture, ColorPlus technology", unit: "each", unit_cost: 15.97, trade: "General", supplier: "James Hardie" },
  { sku: "207350", name: "HardiePlank Lap Siding 12'x6.25\"", description: "Fiber cement, Smooth texture", unit: "each", unit_cost: 12.97, trade: "General", supplier: "James Hardie" },

  // Drywall
  { sku: "141134", name: "1/2\" x 4' x 8' Drywall", description: "Regular, tapered edge", unit: "sheet", unit_cost: 16.97, trade: "General", supplier: "USG" },
  { sku: "141138", name: "1/2\" x 4' x 10' Drywall", description: "Regular, tapered edge", unit: "sheet", unit_cost: 21.97, trade: "General", supplier: "USG" },
  { sku: "141142", name: "1/2\" x 4' x 8' Mold-Tough Drywall", description: "M2Tech, for high-humidity areas", unit: "sheet", unit_cost: 22.97, trade: "General", supplier: "USG" },
  { sku: "141150", name: "5/8\" x 4' x 8' Type X Drywall", description: "Fire-rated, 1-hour per layer", unit: "sheet", unit_cost: 21.97, trade: "General", supplier: "USG" },
  { sku: "380240", name: "All-Purpose Drywall Compound 4.5 Gal", description: "Lightweight, low-VOC, ready-mixed", unit: "bucket", unit_cost: 24.97, trade: "General", supplier: "USG" },
  { sku: "380286", name: "Drywall Joint Tape 250ft", description: "Paper, pre-creased, interior", unit: "roll", unit_cost: 8.97, trade: "General", supplier: "USG" },
  { sku: "15100", name: "1-1/4\" Drywall Screws (5 lb)", description: "Coarse thread, bugle head, black phosphate", unit: "box", unit_cost: 14.97, trade: "General", supplier: "Grip-Rite" },

  // Concrete
  { sku: "100143", name: "80lb Concrete Mix", description: "4000 PSI, Quikrete, 0.6 cu ft yield", unit: "bag", unit_cost: 6.47, trade: "General", supplier: "Quikrete" },
  { sku: "100150", name: "80lb High-Strength Concrete", description: "5000 PSI, Quikrete 5000", unit: "bag", unit_cost: 7.97, trade: "General", supplier: "Quikrete" },
  { sku: "100445", name: "60lb Mortar Mix", description: "Type S, Quikrete, ASTM C270", unit: "bag", unit_cost: 8.47, trade: "General", supplier: "Quikrete" },
  { sku: "135074", name: "#4 Rebar 10ft (1/2\")", description: "Grade 60, ASTM A615", unit: "stick", unit_cost: 8.97, trade: "General", supplier: "Nucor" },
  { sku: "135082", name: "#5 Rebar 10ft (5/8\")", description: "Grade 60, ASTM A615", unit: "stick", unit_cost: 12.97, trade: "General", supplier: "Nucor" },
  { sku: "100066", name: "10 Mil Vapor Barrier 10x100ft", description: "Reinforced, rolls out flat, 1000 sq ft coverage", unit: "roll", unit_cost: 149.00, trade: "General", supplier: "Stego" },
  { sku: "12002", name: "Concrete Expansion Joint 1/2\"x4\"x15ft", description: "Asphalt-impregnated fiber", unit: "stick", unit_cost: 5.97, trade: "General", supplier: "Trim-A-Slab" },

  // Insulation
  { sku: "B128", name: "R-13 Kraft-Faced Batts 15\"x93\" (8-pack)", description: "Fiberglass, 3.5\" thick, 60.08 sq ft per pack", unit: "pack", unit_cost: 44.97, trade: "General", supplier: "Owens Corning" },
  { sku: "B400", name: "R-19 Kraft-Faced Batts 23\"x93\" (6-pack)", description: "Fiberglass, 6.25\" thick, 73.12 sq ft per pack", unit: "pack", unit_cost: 57.97, trade: "General", supplier: "Owens Corning" },
  { sku: "68L", name: "R-30 Unfaced Batts 24\"x48\" (6-pack)", description: "Fiberglass, 9.5\" thick, attic floor", unit: "pack", unit_cost: 52.97, trade: "General", supplier: "Owens Corning" },
  { sku: "R19CW35", name: "R-19 Faced Batts 15\"x93\" (6-pack)", description: "EcoTouch, kraft-faced, 2x6 walls", unit: "pack", unit_cost: 48.97, trade: "General", supplier: "Owens Corning" },
  { sku: "40070", name: "Spray Foam Insulation Kit 200 BF", description: "Closed-cell, 2-component, R-7/in, yields 200 board ft", unit: "kit", unit_cost: 329.00, trade: "General", supplier: "HandiFoam" },
  { sku: "141050", name: "R-10 Rigid Foam Board 4x8", description: "XPS, 2\" thick, square edge, 250kPa", unit: "sheet", unit_cost: 34.97, trade: "General", supplier: "Owens Corning" },

  // Doors & Windows
  { sku: "ZW2055RHT", name: "36\"x80\" Steel Entry Door RH Inswing", description: "6-panel, white primed, brickmold, no glass", unit: "each", unit_cost: 329.00, trade: "General", supplier: "Masonite" },
  { sku: "ZW2055LHT", name: "36\"x80\" Steel Entry Door LH Inswing", description: "6-panel, white primed, brickmold, no glass", unit: "each", unit_cost: 329.00, trade: "General", supplier: "Masonite" },
  { sku: "THDJW23600006", name: "36\"x80\" Vinyl Patio Door", description: "Sliding, white, low-E, screens included", unit: "each", unit_cost: 649.00, trade: "General", supplier: "Jeld-Wen" },
  { sku: "THDJW2368", name: "36\"x80\" Fiberglass Entry Door", description: "Smooth, RH inswing, 6-panel, low-E glass", unit: "each", unit_cost: 549.00, trade: "General", supplier: "Therma-Tru" },
  { sku: "SH3040SLV", name: "30\"x40\" Single-Hung Window", description: "Vinyl, white, low-E/argon, double-strength", unit: "each", unit_cost: 189.00, trade: "General", supplier: "Simonton" },
  { sku: "SH3650SLV", name: "36\"x50\" Single-Hung Window", description: "Vinyl, white, low-E/argon, double-strength", unit: "each", unit_cost: 219.00, trade: "General", supplier: "Simonton" },
  { sku: "SH4860SLV", name: "48\"x60\" Single-Hung Window", description: "Vinyl, white, low-E/argon, double-strength", unit: "each", unit_cost: 259.00, trade: "General", supplier: "Simonton" },

  // Fasteners & Hardware
  { sku: "160242", name: "3\" Deck Screws (5 lb)", description: "Ceramic coated, #10, T25 Torx drive, ACQ approved", unit: "box", unit_cost: 34.97, trade: "General", supplier: "GRK" },
  { sku: "160252", name: "2-1/2\" Deck Screws (5 lb)", description: "Ceramic coated, #9, T25 Torx drive, ACQ approved", unit: "box", unit_cost: 32.97, trade: "General", supplier: "GRK" },
  { sku: "10037", name: "16d Common Nails (1 lb)", description: "3-1/2\" bright smooth, approx 49 nails", unit: "lb", unit_cost: 5.47, trade: "General", supplier: "Grip-Rite" },
  { sku: "10043", name: "8d Common Nails (5 lb)", description: "2-1/2\" bright smooth, framing", unit: "lb", unit_cost: 4.97, trade: "General", supplier: "Grip-Rite" },
  { sku: "HU26", name: "Joist Hanger LUS26 (double shear)", description: "For 2x6, galvanized, face-mount", unit: "each", unit_cost: 2.47, trade: "General", supplier: "Simpson Strong-Tie" },
  { sku: "HU46", name: "Joist Hanger LUS46 (double shear)", description: "For 2x10/2x12, galvanized, face-mount", unit: "each", unit_cost: 3.97, trade: "General", supplier: "Simpson Strong-Tie" },
];

// ─── AGGREGATED CATALOG ────────────────────────────────────────────────────

const ALL_ITEMS: CatalogItem[] = [
  ...ELECTRICAL_ITEMS,
  ...PLUMBING_ITEMS,
  ...HVAC_ITEMS,
  ...ROOFING_ITEMS,
  ...GC_ITEMS,
];

// ─── PUBLIC API ────────────────────────────────────────────────────────────

/**
 * Returns all catalog items for a given trade. Pass "all" to get everything.
 * This is the primary entry point for importing materials into a user's account.
 * Future: replace body with fetch() to a real supplier API.
 */
export function getCatalogForTrade(trade: string): CatalogItem[] {
  if (trade === "all") return ALL_ITEMS;
  const normalized = trade.toLowerCase();
  return ALL_ITEMS.filter(i => i.trade.toLowerCase().includes(normalized));
}

/**
 * Search the catalog by keyword (searches name, SKU, and description).
 * Future: replace body with a supplier API search endpoint.
 */
export function searchCatalog(query: string): CatalogItem[] {
  const q = query.toLowerCase();
  return ALL_ITEMS.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.sku.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q)
  ).slice(0, 50); // Cap at 50 results
}

/**
 * Returns distinct list of trades in the catalog.
 */
export function getAvailableTrades(): string[] {
  return [...new Set(ALL_ITEMS.map(i => i.trade))].sort();
}

/**
 * Returns distinct list of suppliers in the catalog.
 */
export function getAvailableSuppliers(): string[] {
  return [...new Set(ALL_ITEMS.map(i => i.supplier))].sort();
}

/**
 * Total catalog size (for display / validation).
 */
export function getCatalogSize(): number {
  return ALL_ITEMS.length;
}
