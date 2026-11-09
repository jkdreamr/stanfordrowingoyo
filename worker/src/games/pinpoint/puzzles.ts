import { TYPO_MASKS } from './safety.ts';

export interface PinpointPuzzle {
  category: string;
  accepted: string[];
  clues: string[];
  reject: string[];
  typoMask: number;
}

// Append only: row order is the daily schedule, starting 2026-11-16.
export const PINPOINT_DATA = `Words before ball|ball words;compound words with ball;ball|Crystal;Cotton;Snow;Basket;Foot
Things with keys|objects with keys;key holders|Map;Florida;Cipher;Piano;Lock
Words after book|book compounds;book|Worm;End;Mark;Shelf;Case
Things with tongues|objects with tongues;tongue bearers|Buckle;Flame;Bell;Shoe;Mouth
Words before light|light compounds;light|Bud;Lime;Spot;Flash;Sun
Things with crowns|crown wearers;objects with crowns|Pineapple;Road;Tooth;Tree;Monarch
Words after pocket|pocket compounds;pocket|Change;Watch;Knife;Book;Money
Things with rings|objects with rings;ring bearers|Bathtub;Tree;Circus;Telephone;Saturn
Words before house|house compounds;house|Round;Green;Ware;Light;Bird
Things with necks|objects with necks;neck bearers|Isthmus;Guitar;Bottle;Shirt;Giraffe
Words after fire|fire compounds;fire|Fly;Escape;Place;Fighter;Wood
Words before bed|bed compounds;bed|Oyster;Truck;Garden;River;Hospital
Words before board|board compounds;board|Sound;Spring;Cup;Skate;Surf
Words hiding colors|hidden colors;colors inside words|Bred;Incredible;Brownie;Blueprint;Evergreen
Words after brain|brain compounds;brain|Wave;Child;Storm;Wash;Teaser
Things with spines|objects with spines;spine bearers|Cactus;Book;Sea urchin;Porcupine;Vertebrate
Words before cake|cake compounds;cake|Crab;Sponge;Cup;Pan;Cheese
Homophones of letters|letter soundalikes;words sounding like letters|Sea;Queue;Eye;Why;Bee
Words after silver|silver compounds;silver|Screen;Lining;Tongue;Medal;Ware
Things with teeth|objects with teeth;toothed objects|Gear;Zipper;Saw;Comb;Shark
Words before line|ending in line;line|Punch;Clothes;Coast;Finish;Under
Words before pitch|pitch compounds;pitch|Perfect;Sales;Fever;Football;Elevator
Words after rubber|rubber compounds;rubber|Stamp;Plant;Band;Duck;Ball
Things with handles|objects with handles;handled objects|Username;Bicycle;Suitcase;Frying pan;Door
Words before stone|stone compounds;stone|Touch;Mile;Honey;Lime;Gem
Things with tails|objects with tails;tailed things|Coin;Dress coat;Comet;Kite;Dog
Words after tooth|tooth compounds;tooth|Pick;Paste;Ache;Fairy;Brush
Words hiding animals|hidden animals;animals inside words|Scarp;Scattered;Cowl;Beeline;Dogma
Words before break|break compounds;break|Prison;Day;Heart;Ice;Coffee
Words before drop|drop compounds;drop|Name;Back;Gum;Rain;Tear
Words after water|water compounds;water|Mark;Shed;Melon;Fall;Proof
Things with scales|objects with scales;scale bearers|Map;Model railway;Justice;Snake;Fish
Words before jack|jack compounds;jack|Apple;Union;Lumber;Flap;Black
Things with faces|objects with faces;faced objects|Cliff;Diamond;Cube;Clock;Person
Words after butter|butter compounds;butter|Fingers;Cup;Scotch;Milk;Fly
Palindromes|same backwards;words reading both ways|Deified;Rotator;Kayak;Racecar;Radar
Words made of Roman numerals|Roman numeral words;only Roman numeral letters|Mix;Civil;Mild;Livid;Mill
Silent initial letters|words with silent first letters;unpronounced first letters|Heir;Mnemonic;Pterodactyl;Gnome;Knight
Words after thunder|thunder compounds;thunder|Clap;Bird;Cloud;Bolt;Storm
Things with blades|objects with blades;bladed objects|Grass;Turbine;Oar;Skate;Razor`;

let bank: PinpointPuzzle[] | undefined;
export function pinpointPuzzles(): PinpointPuzzle[] {
  return (bank ??= PINPOINT_DATA.split('\n').map((line, index) => {
    const [category, accepted, clues, reject = ''] = line.split('|');
    return {
      category,
      accepted: [category, ...accepted.split(';')],
      clues: clues.split(';'),
      reject: reject ? reject.split(';') : [],
      typoMask: TYPO_MASKS[index] ?? 0,
    };
  }));
}

export function pinpointPuzzleFor(date: string): PinpointPuzzle {
  const puzzles = pinpointPuzzles();
  const day = Math.round(
    (Date.parse(date + 'T12:00:00Z') - Date.parse('2026-11-16T12:00:00Z')) / 86400000,
  );
  return puzzles[((day % puzzles.length) + puzzles.length) % puzzles.length];
}
