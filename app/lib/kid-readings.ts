import type { OrganId } from "./anatomy-data";

/**
 * Plain-language rewrites of the atlas copy, kept in one file rather than inlined
 * into `anatomy-data.ts` so every line a child reads can be reviewed in one pass.
 *
 * `original` is the existing wording in `anatomy-data.ts` and is not repeated here.
 * The two levels below are written by hand — a young reader is the audience, so
 * accuracy and tone matter more than coverage, and nothing here is generated.
 *
 *  - `simple`   ages ~7-9:  short sentences, no Latin, concrete comparisons
 *  - `standard` ages ~10-12: keeps real anatomical words, explains them in place
 */
export type ReadingLevel = "simple" | "standard" | "original";

export const READING_LEVELS: { key: ReadingLevel; label: string; hint: string }[] = [
  { key: "simple", label: "Simple", hint: "Ages 7-9" },
  { key: "standard", label: "Standard", hint: "Ages 10-12" },
  { key: "original", label: "Original", hint: "Grown-up wording" },
];

export const organReadings: Record<OrganId, { simple: string; standard: string }> = {
  heart: {
    simple: "Your heart is a pump made of muscle. It pushes blood all around your body, and it never stops.",
    standard:
      "The heart is a muscular pump. It pushes blood around your body to deliver oxygen and nutrients to every cell.",
  },
  brain: {
    simple: "Your brain is the boss of your body. It helps you think, feel, remember, and move.",
    standard:
      "The brain is your body's control centre. It handles what you sense, what you remember, how you feel, and every move you make.",
  },
  lungs: {
    simple:
      "Your lungs are two soft bags that fill up with air. They take in the air your body needs and push out the air it has finished with.",
    standard:
      "The lungs are a pair of organs that fill with air. They pass oxygen into your blood and take carbon dioxide out of it.",
  },
  liver: {
    simple: "Your liver cleans your blood. It also helps your body use the food you eat.",
    standard:
      "The liver cleans your blood, turns food into things your body can use, and makes a fluid called bile that helps break down fat.",
  },
  kidneys: {
    simple:
      "You have two kidneys and they clean your blood. They take out what your body does not need and turn it into pee.",
    standard:
      "The kidneys are a pair of filters. They clean your blood, keep the right amount of water in your body, and make urine from the waste.",
  },
  eyeball: {
    simple: "Your eye lets you see. Light comes in at the front, and the back sends a picture to your brain.",
    standard:
      "The eye collects light and focuses it onto a layer at the back called the retina, which sends the picture to your brain.",
  },
  intestine: {
    simple:
      "Your intestines are long tubes below your tummy. Food travels through them so your body can take the good parts out.",
    standard:
      "The intestines are long, folded tubes. They soak up the goodness from your food and take back water from what is left.",
  },
  pancreas: {
    simple:
      "Your pancreas helps you digest your food. It also makes insulin, which keeps the sugar in your blood just right.",
    standard:
      "The pancreas makes juices that break food down, plus hormones like insulin that control how much sugar is in your blood.",
  },
  skin: {
    simple:
      "Your skin is your biggest organ. It covers you all over, lets you feel things, and stops you getting too hot or cold.",
    standard:
      "Skin is your largest organ. It keeps water in and germs out, lets you feel touch, and helps control how warm you are.",
  },
};

/**
 * One kid-level line per hotspot, keyed `<organId>:<hotspotId>`. The callout shows
 * this alongside the anatomical wording rather than instead of it, so a parent
 * reading along still sees the real term.
 *
 * Only the hotspots whose own wording needs it appear here — "Aorta: Main artery"
 * is already plain, so it has no entry and the callout simply shows one line.
 */
export const hotspotReadings: Record<string, string> = {
  // Heart — "atrium"/"ventricle" mean nothing to a child, so name them as rooms.
  "heart:left-atrium": "The room that takes in blood full of oxygen",
  "heart:right-atrium": "The room that takes in blood coming back from your body",
  "heart:left-ventricle": "The room that pushes blood out to your whole body",
  "heart:right-ventricle": "The room that pushes blood up to your lungs",
  "heart:mitral": "A little door that stops blood going the wrong way",

  // Brain
  "brain:frontal": "The front part, for planning and moving",
  "brain:parietal": "The part that puts together everything you feel",
  "brain:temporal": "The side part, for remembering and hearing",
  "brain:cerebellum": "The small bit at the back that keeps you steady",

  // Lungs
  "lungs:right-lung": "The right one, made of three pieces",
  "lungs:left-lung": "The left one has two pieces, to leave room for your heart",
  "lungs:bronchus": "A tube that splits into smaller and smaller tubes",
  "lungs:base": "The bottom, resting on the muscle that helps you breathe",

  // Liver
  "liver:right-lobe": "The biggest part of your liver",
  "liver:left-lobe": "The part that reaches across your middle",
  "liver:portal": "The tube that brings in goodness from your food",

  // Kidneys
  "kidneys:cortex": "The outside layer, where the cleaning happens",
  "kidneys:medulla": "The inside part that makes pee stronger",
  "kidneys:ureter": "The tube that carries pee away",

  // Eye
  "eyeball:cornea": "The clear window at the front",
  "eyeball:iris": "The coloured ring that lets in more light or less",
  "eyeball:optic": "The cable that sends pictures to your brain",

  // Intestine
  "intestine:duodenum": "The first part, just after your stomach",
  "intestine:jejunum": "The middle part, where you soak up your food",
  "intestine:colon": "The last part, which takes water back",

  // Pancreas
  "pancreas:head": "The fat end, tucked into the start of your gut",
  "pancreas:body": "The middle, lying across your backbone",
  "pancreas:tail": "The thin end, stretching over to your spleen",
  "pancreas:duct": "A tube that carries the juices to your gut",

  // Skin
  "skin:epidermis": "The outside layer that protects you",
  "skin:dermis": "The layer underneath, full of tiny nerves and tubes",
  "skin:hypodermis": "The soft fatty layer that keeps you warm",
  "skin:follicle": "The little pocket that holds one hair in place",
};

/** The level-appropriate organ description. */
export function organDescription(
  organId: OrganId,
  original: string,
  level: ReadingLevel,
): string {
  return level === "original" ? original : organReadings[organId][level];
}

/**
 * The kid line for a hotspot, or `null` when its own wording is already plain
 * enough that a second line would just repeat it.
 */
export function hotspotReading(
  organId: OrganId,
  hotspotId: string,
  level: ReadingLevel,
): string | null {
  if (level === "original") return null;
  return hotspotReadings[`${organId}:${hotspotId}`] ?? null;
}
