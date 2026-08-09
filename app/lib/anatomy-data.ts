export type OrganId =
  | "heart"
  | "brain"
  | "lungs"
  | "liver"
  | "kidneys"
  | "eyeball"
  | "intestine"
  | "pancreas"
  | "skin";

export type Hotspot = {
  id: string;
  label: string;
  /**
   * What the part does, then — after an em dash — why it is shaped the way it is.
   *
   * The second clause is not decoration. The Ask panel offers every tapped hotspot
   * a "Why is it that shape?" button, and the model may only use the facts it is
   * given, so a detail that names a function and stops turns that button into an
   * honest "I don't know". Function alone is enough only where the wording already
   * accounts for the form — "Two lobes, room for the heart" does, and so carries
   * no dash.
   *
   * Keep the clause to a few words: it renders in a 168px callout at 10px.
   */
  detail: string;
  position: [number, number, number];
  color: string;
};

export type Organ = {
  id: OrganId;
  name: string;
  scientificName: string;
  system: string;
  model: string;
  icon: string;
  accent: string;
  description: string;
  poetic: string;
  size: string;
  weight: string;
  location: string;
  function: string;
  dailyFact: string;
  medical: string;
  bloodSupply: string;
  /** A single memorable line, surfaced as the "Did you know" note. */
  funFact: string;
  tissue: string;
  comparison: string;
  conditions: string[];
  hotspots: Hotspot[];
  /** Whether `/anatomy/<id>/*.webp` illustrations exist. Organs without them
   *  fall back to the accent glyph rather than a broken image. */
  illustrated: boolean;
};

export const organs: Organ[] = [
  {
    id: "heart",
    name: "Heart",
    scientificName: "Cor",
    system: "Cardiovascular",
    model: "/models/heart.glb",
    icon: "♥",
    accent: "#ee7c6a",
    description: "A muscular organ that pumps blood throughout the body, delivering oxygen and nutrients to every cell.",
    poetic: "The tireless pump",
    size: "About the size of your fist",
    weight: "250–350 g",
    location: "Behind the sternum, slightly left",
    function: "Circulates oxygenated blood",
    dailyFact: "Beats about 100,000 times",
    medical: "Its electrical rhythm coordinates every heartbeat.",
    bloodSupply: "Left and right coronary arteries",
    funFact: "It beats roughly 2.5 billion times in an average lifetime, and starts before you are born.",
    tissue: "Cardiac muscle tissue",
    comparison: "Heart vs. brain",
    conditions: ["Coronary artery disease", "Arrhythmia", "Heart valve disorders", "Heart failure", "Cardiomyopathy", "Myocarditis", "Atrial fibrillation", "Congenital heart defects"],
    illustrated: true,
    hotspots: [
      { id: "aorta", label: "Aorta", detail: "Main artery — wide and springy to absorb each beat", position: [-0.35, 1.65, 0.55], color: "#ee7c6a" },
      { id: "left-atrium", label: "Left Atrium", detail: "Receives oxygenated blood — thin walls for a short push", position: [0.82, 0.65, 0.5], color: "#f2a33b" },
      { id: "right-atrium", label: "Right Atrium", detail: "Receives venous blood — thin walls for a short push", position: [-0.9, 0.35, 0.55], color: "#6393d8" },
      { id: "left-ventricle", label: "Left Ventricle", detail: "Pumps to the body — the thickest wall, for the longest push", position: [0.7, -0.75, 0.65], color: "#f2a33b" },
      { id: "right-ventricle", label: "Right Ventricle", detail: "Pumps to the lungs — a thinner wall for a shorter trip", position: [-0.65, -0.68, 0.66], color: "#ee7c6a" },
      { id: "mitral", label: "Mitral Valve", detail: "Prevents backflow — two thin flaps the blood pushes shut", position: [0.18, -1.35, 0.48], color: "#d89bc4" },
    ],
  },
  {
    id: "brain",
    name: "Brain",
    scientificName: "Encephalon",
    system: "Nervous System",
    model: "/models/brain.glb",
    icon: "◉",
    accent: "#c58696",
    description: "The body’s command center, integrating sensation, memory, emotion, and precise movement.",
    poetic: "The universe within",
    size: "Roughly two clenched fists",
    weight: "1.3–1.4 kg",
    location: "Protected within the skull",
    function: "Processes and coordinates signals",
    dailyFact: "Uses about 20% of the body’s energy",
    medical: "Billions of neurons communicate through electrical and chemical signals.",
    bloodSupply: "Internal carotid and vertebral arteries",
    funFact: "It has no pain receptors of its own — a headache is felt in the tissues around it.",
    tissue: "Cerebral cortex",
    comparison: "Brain vs. eye",
    conditions: ["Migraine", "Stroke", "Neurodegenerative disease", "Epilepsy", "Traumatic brain injury", "Meningitis", "Multiple sclerosis", "Brain aneurysm"],
    illustrated: true,
    hotspots: [
      { id: "frontal", label: "Frontal Lobe", detail: "Planning & movement — the largest lobe, folded to fit", position: [-0.7, 0.65, 0.8], color: "#ee7c6a" },
      { id: "parietal", label: "Parietal Lobe", detail: "Sensory integration — folds pack in more cortex", position: [0.15, 1.1, 0.65], color: "#f2a33b" },
      { id: "temporal", label: "Temporal Lobe", detail: "Memory & hearing — folded and tucked low, beside each ear", position: [0.75, -0.1, 0.82], color: "#6393d8" },
      { id: "cerebellum", label: "Cerebellum", detail: "Balance & coordination — far finer folds, tightly packed", position: [0.72, -0.9, 0.55], color: "#d89bc4" },
    ],
  },
  {
    id: "lungs",
    name: "Lungs",
    scientificName: "Pulmones",
    system: "Respiratory System",
    model: "/models/lungs.glb",
    icon: "◍",
    accent: "#dd8f8b",
    description: "Paired organs that draw in air and trade oxygen for carbon dioxide across a vast, delicate surface.",
    poetic: "The breath of life",
    size: "Each about 25 cm tall",
    weight: "About 1 kg for the pair",
    location: "Either side of the heart, within the ribcage",
    function: "Exchanges oxygen for carbon dioxide",
    dailyFact: "Moves around 11,000 L of air",
    medical: "Alveoli fold a tennis-court-sized exchange surface into the chest.",
    bloodSupply: "Pulmonary and bronchial arteries",
    funFact: "The right lung carries three lobes and the left only two, leaving a notch for the heart.",
    tissue: "Alveolar tissue",
    comparison: "Lungs vs. heart",
    conditions: ["Asthma", "COPD", "Pneumonia", "Pulmonary embolism", "Pulmonary fibrosis", "Bronchitis", "Cystic fibrosis", "Lung cancer"],
    illustrated: true,
    hotspots: [
      { id: "trachea", label: "Trachea", detail: "Carries air to the lungs — stiff rings hold the tube open", position: [0, 1.6, 0.2], color: "#6393d8" },
      { id: "right-lung", label: "Right Lung", detail: "Three lobes — the larger side, since the heart leans left", position: [-1.2, 0.1, 0.7], color: "#ee7c6a" },
      { id: "left-lung", label: "Left Lung", detail: "Two lobes, room for the heart", position: [1.2, 0.1, 0.7], color: "#f2a33b" },
      { id: "bronchus", label: "Bronchus", detail: "Branching airway — splits over and over to reach every corner", position: [-0.03, 0.3, 0.35], color: "#d89bc4" },
      { id: "base", label: "Lung Base", detail: "Rests on the diaphragm — dished to match its dome", position: [-1.14, -1.2, 1], color: "#7fa88a" },
    ],
  },
  {
    id: "liver",
    name: "Liver",
    scientificName: "Hepar",
    system: "Digestive System",
    model: "/models/liver.glb",
    icon: "≈",
    accent: "#b86858",
    description: "A remarkable metabolic organ that filters blood, processes nutrients, and produces bile.",
    poetic: "The quiet alchemist",
    size: "About the size of a football",
    weight: "1.4–1.6 kg",
    location: "Upper right abdomen",
    function: "Metabolism, detoxification & bile",
    dailyFact: "Performs more than 500 functions",
    medical: "It can regenerate a substantial portion of lost tissue.",
    bloodSupply: "Hepatic artery and portal vein",
    funFact: "It is the only human organ that can regrow to full size from a fraction of itself.",
    tissue: "Hepatic lobules",
    comparison: "Liver vs. intestine",
    conditions: ["Fatty liver disease", "Hepatitis", "Cirrhosis", "Gallstones", "Haemochromatosis", "Liver cancer", "Autoimmune hepatitis", "Portal hypertension"],
    illustrated: true,
    hotspots: [
      { id: "right-lobe", label: "Right Lobe", detail: "Largest hepatic lobe — domed to fit under the diaphragm", position: [-0.75, 0.35, 0.75], color: "#ee7c6a" },
      { id: "left-lobe", label: "Left Lobe", detail: "Crosses the midline — flatter, moulded over the stomach", position: [0.85, 0.25, 0.75], color: "#f2a33b" },
      { id: "portal", label: "Portal Vein", detail: "Nutrient-rich inflow — splits finer to reach every lobule", position: [0.1, -0.3, 0.82], color: "#6393d8" },
    ],
  },
  {
    id: "kidneys",
    name: "Kidneys",
    scientificName: "Renes",
    system: "Urinary System",
    model: "/models/kidneys.glb",
    icon: "∞",
    accent: "#c96963",
    description: "Paired filtration organs that balance fluids, electrolytes, blood pressure, and waste removal.",
    poetic: "The master filters",
    size: "Each is about a computer mouse",
    weight: "120–170 g each",
    location: "Either side of the spine below the ribs",
    function: "Filters blood and forms urine",
    dailyFact: "Filters roughly 180 L of fluid",
    medical: "Nephrons fine-tune the chemistry of the bloodstream.",
    bloodSupply: "Renal arteries",
    funFact: "They reclaim almost everything they filter — only about 1–2 L leaves the body as urine.",
    tissue: "Renal cortex",
    comparison: "Kidneys vs. liver",
    conditions: ["Kidney stones", "Chronic kidney disease", "Urinary infection", "Glomerulonephritis", "Polycystic kidney disease", "Renal hypertension", "Acute kidney injury", "Nephrotic syndrome"],
    illustrated: true,
    hotspots: [
      { id: "cortex", label: "Renal Cortex", detail: "Outer filtering layer — a shell of about a million filters", position: [-0.9, 0.55, 0.7], color: "#ee7c6a" },
      { id: "medulla", label: "Renal Medulla", detail: "Concentrates urine — cone-shaped pyramids funnel it inwards", position: [0.85, 0.2, 0.7], color: "#f2a33b" },
      { id: "ureter", label: "Ureter", detail: "Carries urine — a narrow muscular tube that squeezes it down", position: [0.4, -1.1, 0.5], color: "#6393d8" },
    ],
  },
  {
    id: "eyeball",
    name: "Eye",
    scientificName: "Oculus",
    system: "Sensory System",
    model: "/models/eyeball.glb",
    icon: "⊙",
    accent: "#7294b9",
    description: "A precision sensory organ that converts focused light into neural signals interpreted as vision.",
    poetic: "A window made of light",
    size: "About 24 mm across",
    weight: "Around 7.5 g",
    location: "Within the bony orbit",
    function: "Captures and focuses light",
    dailyFact: "Makes thousands of tiny movements",
    medical: "The retina is an extension of the central nervous system.",
    bloodSupply: "Ophthalmic artery",
    funFact: "The cornea carries no blood vessels at all; it takes oxygen directly from the air.",
    tissue: "Retinal layers",
    comparison: "Eye vs. brain",
    conditions: ["Myopia", "Cataract", "Glaucoma", "Macular degeneration", "Retinal detachment", "Dry eye disease", "Astigmatism", "Conjunctivitis"],
    illustrated: true,
    hotspots: [
      { id: "cornea", label: "Cornea", detail: "Clear focusing surface — domed, so its curve bends the light", position: [-0.94, 0.05, 1.47], color: "#6393d8" },
      { id: "iris", label: "Iris", detail: "Controls light entry — a muscle ring that narrows the pupil", position: [-1.22, -0.53, 1.15], color: "#f2a33b" },
      { id: "optic", label: "Optic Nerve", detail: "Carries visual signals — a cable of about a million fibres", position: [1.61, -0.18, 0.54], color: "#d89bc4" },
    ],
  },
  {
    id: "intestine",
    name: "Intestine",
    scientificName: "Intestinum",
    system: "Digestive System",
    model: "/models/intestine.glb",
    icon: "§",
    accent: "#d78b77",
    description: "A folded digestive passage where nutrients are absorbed and the microbiome supports whole-body health.",
    poetic: "The inner garden",
    size: "About 6–7 m when extended",
    weight: "Varies with contents",
    location: "Central and lower abdomen",
    function: "Digestion and nutrient absorption",
    dailyFact: "Hosts trillions of microorganisms",
    medical: "Its surface is amplified by folds, villi, and microvilli.",
    bloodSupply: "Superior and inferior mesenteric arteries",
    funFact: "Its lining renews itself every few days — the fastest turnover of any tissue in the body.",
    tissue: "Intestinal villi",
    comparison: "Intestine vs. liver",
    conditions: ["Irritable bowel syndrome", "Inflammatory bowel disease", "Celiac disease", "Diverticulitis", "Intestinal obstruction", "Colorectal polyps", "Crohn's disease", "Lactose intolerance"],
    illustrated: true,
    hotspots: [
      { id: "duodenum", label: "Duodenum", detail: "First small-intestine segment — a C curled round the pancreas", position: [0.6, 0.8, 0.75], color: "#f2a33b" },
      { id: "jejunum", label: "Jejunum", detail: "Major absorption region — long and deeply folded for surface", position: [-0.45, 0.1, 0.82], color: "#ee7c6a" },
      { id: "colon", label: "Colon", detail: "Reclaims water — a wider tube, holding what is left for longer", position: [0.75, -0.55, 0.72], color: "#6393d8" },
    ],
  },
  {
    id: "pancreas",
    name: "Pancreas",
    scientificName: "Pancreas",
    system: "Endocrine System",
    model: "/models/pancreas.glb",
    icon: "◈",
    accent: "#c69a5e",
    description: "A dual-purpose gland that releases digestive enzymes into the gut and the hormones that steady blood sugar.",
    poetic: "The quiet regulator",
    size: "About 15 cm long",
    weight: "70–100 g",
    location: "Behind the stomach, across the upper abdomen",
    function: "Digestive enzymes and insulin",
    dailyFact: "Makes about 1.5 L of enzyme-rich juice",
    medical: "Islets of Langerhans release insulin and glucagon to balance blood sugar.",
    bloodSupply: "Splenic and pancreaticoduodenal arteries",
    funFact: "Barely 2% of it makes hormones; the rest is given over to digestive enzymes.",
    tissue: "Pancreatic acini",
    comparison: "Pancreas vs. liver",
    conditions: ["Pancreatitis", "Type 1 diabetes", "Pancreatic cancer", "Type 2 diabetes", "Exocrine insufficiency", "Pancreatic cysts", "Gallstone pancreatitis", "Insulinoma"],
    illustrated: true,
    hotspots: [
      { id: "head", label: "Head", detail: "Cradled by the duodenum — the broad end, filling its C-curve", position: [-1.32, -0.36, 0.55], color: "#ee7c6a" },
      { id: "body", label: "Body", detail: "Crosses the spine — flattened between stomach and backbone", position: [0.05, 0.25, 0.45], color: "#f2a33b" },
      { id: "tail", label: "Tail", detail: "Reaches the spleen — narrowing to a thin tip", position: [1.55, 0.3, 0.35], color: "#6393d8" },
      { id: "duct", label: "Pancreatic Duct", detail: "Drains enzymes to the gut — one thin channel down its length", position: [-0.61, 0.39, 0.5], color: "#d89bc4" },
    ],
  },
  {
    id: "skin",
    name: "Skin",
    scientificName: "Integumentum",
    system: "Integumentary System",
    model: "/models/skin.glb",
    icon: "▦",
    accent: "#c99277",
    description: "The body’s largest organ — a living barrier that senses touch, holds in water, and regulates temperature.",
    poetic: "The living boundary",
    size: "About 2 m² spread flat",
    weight: "3.5–5 kg",
    location: "Covering the entire body",
    function: "Protects, senses, and cools",
    dailyFact: "Sheds around 500 million cells",
    medical: "Three layers — epidermis, dermis, and hypodermis — each with a distinct job.",
    bloodSupply: "Dermal vascular plexus",
    funFact: "A single square centimetre can hold hundreds of sweat glands and metres of blood vessels.",
    tissue: "Epidermal layers",
    comparison: "Skin vs. intestine",
    conditions: ["Eczema", "Psoriasis", "Melanoma", "Acne vulgaris", "Cellulitis", "Contact dermatitis", "Rosacea", "Vitiligo"],
    illustrated: true,
    hotspots: [
      { id: "epidermis", label: "Epidermis", detail: "Outer protective layer — flat cells stacked like tiles", position: [-0.05, 0.88, 1.4], color: "#ee7c6a" },
      { id: "dermis", label: "Dermis", detail: "Nerves, vessels & glands — thick, woven from stretchy fibres", position: [0.29, 0.05, 1.4], color: "#f2a33b" },
      { id: "hypodermis", label: "Hypodermis", detail: "Fat and insulation — a soft padded layer underneath", position: [-0.39, -1.15, 1.4], color: "#6393d8" },
      { id: "follicle", label: "Hair Follicle", detail: "Anchors each hair — a narrow pocket slanting into the skin", position: [0.89, -0.44, 1.4], color: "#d89bc4" },
    ],
  },
];

export const organById = Object.fromEntries(organs.map((organ) => [organ.id, organ])) as Record<OrganId, Organ>;

export type ReferenceKind = "condition" | "tissue" | "comparison";

export type ReferenceEntry = {
  kind: ReferenceKind;
  /** The indexed term itself — "Arrhythmia", "Cardiac muscle tissue", "Heart vs. brain". */
  label: string;
  organ: Organ;
};

/**
 * Every condition, tissue, and comparison across `organs`, flattened into one
 * alphabetical list that points back at the organ each term belongs to. These
 * details are otherwise reachable only by opening one organ at a time, which
 * makes them impossible to search across.
 *
 * Every condition string in the data is currently unique to a single organ, so
 * an entry maps to exactly one organ rather than a list of them.
 */
export const referenceIndex: ReferenceEntry[] = organs
  .flatMap((organ) => [
    ...organ.conditions.map((label) => ({ kind: "condition" as const, label, organ })),
    { kind: "tissue" as const, label: organ.tissue, organ },
    { kind: "comparison" as const, label: organ.comparison, organ },
  ])
  .sort((a, b) => a.label.localeCompare(b.label));

export type BodySystem = {
  /** The `system` value shared by every organ in the group. */
  name: string;
  organs: Organ[];
};

/**
 * `organs` regrouped by `system`, in the order each system first appears. Derived
 * rather than hand-written so a new organ joins its system automatically, and an
 * organ carrying a brand-new `system` string becomes its own group rather than
 * silently vanishing from the systems index.
 */
export const systems: BodySystem[] = organs.reduce<BodySystem[]>((grouped, organ) => {
  const existing = grouped.find((system) => system.name === organ.system);
  if (existing) existing.organs.push(organ);
  else grouped.push({ name: organ.system, organs: [organ] });
  return grouped;
}, []);
