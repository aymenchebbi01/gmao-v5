export interface FailureCause {
  id: string;
  labelFr: string;
  labelEn: string;
}

export interface FailureCategory {
  id: string;
  labelFr: string;
  labelEn: string;
  causes: FailureCause[];
}

export const FAILURE_CAUSE_CATEGORIES: FailureCategory[] = [
  {
    id: 'mechanical',
    labelFr: 'Mécanique',
    labelEn: 'Mechanical',
    causes: [
      { id: 'mech_lubrication', labelFr: 'Défaut de lubrification', labelEn: 'Lubrication failure' },
      { id: 'mech_wear', labelFr: 'Usure mécanique / Jeu excessif', labelEn: 'Mechanical wear / Play' },
      { id: 'mech_breakage', labelFr: 'Casse mécanique / Blocage', labelEn: 'Mechanical breakage / Jam' },
      { id: 'mech_column', labelFr: 'Guidage / Colonnes / Bagues usées', labelEn: 'Guide bars / Bushings wear' },
      { id: 'mech_toggle', labelFr: 'Genouillère / Verrouillage mécanique', labelEn: 'Toggle linkage / Clamping mechanism' },
      { id: 'mech_belt', labelFr: 'Courroie / Transmission / Chaîne', labelEn: 'Belt / Drive transmission / Chain' },
    ],
  },
  {
    id: 'electrical',
    labelFr: 'Électrique',
    labelEn: 'Electrical',
    causes: [
      { id: 'elec_motor', labelFr: 'Moteur principal / Pompe électrique', labelEn: 'Main motor / Electric pump' },
      { id: 'elec_relay', labelFr: 'Relais / Contacteur / Fusible grillé', labelEn: 'Relay / Contactor / Blown fuse' },
      { id: 'elec_sensor', labelFr: 'Capteur de fin de course / Détecteur', labelEn: 'Limit switch / Proximity sensor' },
      { id: 'elec_power', labelFr: 'Coupure alimentation / Disjoncteur déclenché', labelEn: 'Power trip / Circuit breaker tripped' },
      { id: 'elec_wiring', labelFr: 'Câblage défectueux / Faux contact', labelEn: 'Wiring fault / Loose connection' },
      { id: 'elec_inverter', labelFr: 'Variateur de vitesse / Drive', labelEn: 'VFD / Inverter drive fault' },
    ],
  },
  {
    id: 'hydraulic',
    labelFr: 'Hydraulique',
    labelEn: 'Hydraulic',
    causes: [
      { id: 'hyd_leak', labelFr: 'Fuite flexible ou raccord hydraulique', labelEn: 'Hydraulic hose or fitting leak' },
      { id: 'hyd_valve', labelFr: 'Distributeur / Électrovanne proportionnelle bloquée', labelEn: 'Stuck proportional / directional valve' },
      { id: 'hyd_pressure', labelFr: 'Chute de pression / Défaut pompe hydraulique', labelEn: 'Pressure drop / Hydraulic pump fault' },
      { id: 'hyd_temp', labelFr: 'Surchauffe huile hydraulique (> 55°C)', labelEn: 'Hydraulic oil overheat (> 55°C)' },
      { id: 'hyd_filter', labelFr: 'Filtre retour/pression colmaté', labelEn: 'Clogged return / pressure filter' },
      { id: 'hyd_accumulator', labelFr: 'Accumulateur azote déchargé', labelEn: 'Discharged nitrogen accumulator' },
    ],
  },
  {
    id: 'pneumatic',
    labelFr: 'Pneumatique',
    labelEn: 'Pneumatic',
    causes: [
      { id: 'pneu_leak', labelFr: 'Fuite air comprimé / Raccord rapide', labelEn: 'Compressed air leak / Quick coupler' },
      { id: 'pneu_cylinder', labelFr: 'Vérin pneumatique / Éjecteur bloqué', labelEn: 'Pneumatic cylinder / Ejector jam' },
      { id: 'pneu_pressure', labelFr: 'Pression réseau insuffisante (< 6 bar)', labelEn: 'Low pneumatic pressure (< 6 bar)' },
      { id: 'pneu_valve', labelFr: 'Distributeur pneumatique / Électrovanne air', labelEn: 'Pneumatic solenoid valve' },
    ],
  },
  {
    id: 'automation',
    labelFr: 'Automatisme & PLC',
    labelEn: 'Automation & PLC',
    causes: [
      { id: 'plc_error', labelFr: 'Erreur automate CPU / Watchdog', labelEn: 'PLC CPU error / Watchdog' },
      { id: 'plc_io', labelFr: 'Carte E/S numérique ou analogique défaillante', labelEn: 'Digital / Analog I/O card fault' },
      { id: 'plc_hmi', labelFr: 'Écran tactile / Pupitre opérateur bloqué', labelEn: 'HMI touchscreen freeze / Crash' },
      { id: 'plc_comm', labelFr: 'Perte communication bus de terrain (Profibus/CanOpen)', labelEn: 'Fieldbus communication loss' },
    ],
  },
  {
    id: 'heating',
    labelFr: 'Chauffe / Thermique',
    labelEn: 'Heating / Thermal',
    causes: [
      { id: 'heat_band', labelFr: 'Collier chauffant coupé / grillé', labelEn: 'Heater band open / burned out' },
      { id: 'heat_tc', labelFr: 'Thermocouple cassé / Sonde en dérive', labelEn: 'Broken thermocouple / Sensor drift' },
      { id: 'heat_ssr', labelFr: 'Relais statique (SSR) en court-circuit / HS', labelEn: 'Solid state relay (SSR) defect' },
      { id: 'heat_zone', labelFr: 'Régulateur PID / Zone de chauffe hors tolérance', labelEn: 'PID controller / Out of temp band' },
    ],
  },
  {
    id: 'cooling',
    labelFr: 'Refroidissement / Eau',
    labelEn: 'Cooling / Water',
    causes: [
      { id: 'cool_circuit', labelFr: 'Circuit eau bouché / Débit faible', labelEn: 'Clogged cooling line / Low flow' },
      { id: 'cool_chiller', labelFr: 'Défaut groupe de froid / Chiller externe', labelEn: 'Chiller unit trip / Temperature fault' },
      { id: 'cool_leak', labelFr: 'Fuite raccord eau / Joint torique détérioré', labelEn: 'Water coupling leak / Damaged O-ring' },
      { id: 'cool_valve', labelFr: 'Électrovanne eau de refroidissement grippée', labelEn: 'Seized water cooling solenoid valve' },
    ],
  },
  {
    id: 'feeding',
    labelFr: 'Alimentation Matière',
    labelEn: 'Material Feeding',
    causes: [
      { id: 'feed_block', labelFr: 'Trémie bouchée / Voûte matière', labelEn: 'Hopper blockage / Material bridging' },
      { id: 'feed_dryer', labelFr: 'Dessiccateur / Déshumidificateur en défaut', labelEn: 'Dryer / Dehumidifier fault' },
      { id: 'feed_loader', labelFr: 'Chargeur automatique sous vide bloqué', labelEn: 'Vacuum auto-loader failure' },
      { id: 'feed_sensor', labelFr: 'Détecteur capacitif niveau matière HS', labelEn: 'Capacitive level sensor defect' },
    ],
  },
  {
    id: 'mold',
    labelFr: 'Moule / Outillage',
    labelEn: 'Mold / Tooling',
    causes: [
      { id: 'mold_cavity', labelFr: 'Empreinte rayée / détériorée / bavure', labelEn: 'Scratched / Damaged cavity / Burrs' },
      { id: 'mold_ejector', labelFr: 'Éjecteur tordu / cassé / grippé', labelEn: 'Bent / Broken / Seized ejector pin' },
      { id: 'mold_runner', labelFr: 'Canal chaud bouché / Fuite buse injection', labelEn: 'Hot runner blocked / Nozzle leakage' },
      { id: 'mold_slider', labelFr: 'Tiroir / Coulisseau bloqué', labelEn: 'Stuck slide / Cam pin binding' },
      { id: 'mold_water', labelFr: 'Fuite circuit eau interne au moule', labelEn: 'Internal mold water leak' },
    ],
  },
  {
    id: 'human',
    labelFr: 'Opérationnel / Humain',
    labelEn: 'Operational / Human',
    causes: [
      { id: 'human_params', labelFr: 'Mauvais réglage paramètres process', labelEn: 'Incorrect process recipe settings' },
      { id: 'human_handling', labelFr: 'Erreur manipulation opérateur', labelEn: 'Operator handling / Clamping error' },
      { id: 'human_safety', labelFr: 'Arrêt urgence déclenché par erreur', labelEn: 'Accidental emergency stop trigger' },
    ],
  },
  {
    id: 'quality',
    labelFr: 'Qualité / Process',
    labelEn: 'Quality / Process',
    causes: [
      { id: 'qual_flash', labelFr: 'Bavure excessive sur plan de joint', labelEn: 'Excessive flash on parting line' },
      { id: 'qual_short', labelFr: 'Pièce incomplète / Manque matière', labelEn: 'Short shot / Incomplete filling' },
      { id: 'qual_sink', labelFr: 'Retassures / Déformation thermique', labelEn: 'Sink marks / Warpage' },
      { id: 'qual_burn', labelFr: 'Brûlures / Dégradation thermique matière', labelEn: 'Burn marks / Diesel effect' },
      { id: 'qual_color', labelFr: 'Défaut de coloration / Masterbatch hétérogène', labelEn: 'Color variation / Streaks' },
    ],
  },
  {
    id: 'other',
    labelFr: 'Autre Cause',
    labelEn: 'Other Cause',
    causes: [
      { id: 'other_custom', labelFr: 'Autre cause spécifique à préciser', labelEn: 'Specific cause to detail' },
    ],
  },
];
