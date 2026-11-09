import { TYPO_MASKS } from './safety.ts';

export interface PinpointPuzzle {
  kind: 'C' | 'T' | 'S' | 'W';
  category: string;
  accepted: string[];
  clues: string[];
  reject: string[];
  typoMask: number;
}

// Append only: row order is the daily schedule, starting 2026-11-16.
export const PINPOINT_DATA = `C|Words before ball|ball words;compound words with ball;ball;words that come before ball|Crystal;Cotton;Snow;Basket;Foot
T|Things with keys|objects with keys;key holders|Map;Florida;Cipher;Piano;Lock
C|Words after book|book compounds;book|Worm;End;Mark;Shelf;Case
S|Pixar movies|Pixar films;Pixar;Disney Pixar movies|Up;Soul;Cars;Brave;Toy Story
W|Words hiding colors|hidden colors;colors inside words|Bred;Incredible;Brownie;Blueprint;Evergreen
C|Words before light|light compounds;light|Bud;Lime;Spot;Flash;Sun
T|Things with tongues|objects with tongues;tongue bearers|Buckle;Flame;Bell;Shoe;Mouth
C|Words after pocket|pocket compounds;pocket|Change;Watch;Knife;Book;Money
S|Types of knots|knots;rope knots;rope ties|Granny;Sheepshank;Clove hitch;Bowline;Square
W|Homophones of letters|letter soundalikes;words sounding like letters|Sea;Queue;Eye;Why;Bee
C|Words before house|house compounds;house|Round;Green;Ware;Light;Bird
T|Things with crowns|crown wearers;objects with crowns|Pineapple;Road;Tooth;Tree;Monarch
S|Chess pieces|chessmen;pieces in chess;chess units|Rook;Bishop;Knight;Queen;Pawn
W|Words hiding animals|hidden animals;animals inside words|Scarp;Scattered;Cowl;Beeline;Dogma
S|Card games|playing card games;games with cards;card based games|Patience;War;Hearts;Bridge;Poker
C|Words after fire|fire compounds;fire|Fly;Escape;Place;Fighter;Wood
T|Things with rings|objects with rings;ring bearers|Bathtub;Tree;Circus;Telephone;Saturn
C|Words before bed|bed compounds;bed|Oyster;Truck;Garden;River;Hospital
S|Cloud formations|cloud types;meteorological clouds;kinds of clouds|Anvil;Lenticular;Cirrus;Cumulus;Stratus
W|Palindromes|same backwards;words reading both ways|Deified;Rotator;Kayak;Racecar;Radar
C|Words before board|board compounds;board|Sound;Spring;Drawing;Skate;Surf
T|Things with necks|objects with necks;neck bearers|Isthmus;Guitar;Bottle;Shirt;Giraffe
C|Words after brain|brain compounds;brain|Wave;Child;Storm;Wash;Teaser
S|NATO alphabet words|NATO phonetic alphabet;military spelling alphabet;phonetic alphabet|Hotel;Golf;Juliett;Whiskey;Alpha
W|Words made of Roman numerals|Roman numeral words;only Roman numeral letters|Mix;Civil;Mild;Livid;Mill
C|Words before cake|cake compounds;cake|Crab;Sponge;Cup;Pan;Cheese
T|Things with spines|objects with spines;spine bearers|Cactus;Book;Sea urchin;Porcupine;Vertebrate
C|Words after silver|silver compounds;silver|Screen;Lining;Tongue;Medal;Ware
S|Pasta shapes|pasta varieties;types of pasta;pasta|Shells;Wheels;Elbows;Bow ties;Spaghetti
W|Silent initial letters|words with silent first letters;unpronounced first letters;silent first letters|Heir;Mnemonic;Pterodactyl;Gnome;Knight
C|Words before line|ending in line;line|Punch;Clothes;Coast;Finish;Under
T|Things with teeth|objects with teeth;toothed objects|Gear;Zipper;Saw;Comb;Shark
S|Greek letters|Greek alphabet;letters of Greek;Greek alphabet letters|Delta;Mu;Pi;Sigma;Omega
W|Words that become new words with S in front|add S to the start;S prefix wordplay;prepend S|Laughter;Lumber;Lash;Pin;Tar
S|Dog breeds|breeds of dog;canine breeds;dogs|Boxer;Pointer;Chow chow;Beagle;Poodle
C|Words before pitch|pitch compounds;pitch|Perfect;Sales;Fever;Football;Elevator
T|Things with handles|objects with handles;handled objects|Username;Bicycle;Suitcase;Frying pan;Door
C|Words after rubber|rubber compounds;rubber|Stamp;Plant;Band;Duck;Ball
S|Cocktails|mixed alcoholic drinks;cocktail drinks;bar cocktails|Aviation;Sidecar;Grasshopper;Negroni;Margarita
W|A B can be prepended|add B to the start;B prefix wordplay;prepend B|Lend;Ranch;Rim;Rake;Ear
C|Words before stone|stone compounds;stone|Touch;Mile;Honey;Lime;Gem
T|Things with tails|objects with tails;tailed things|Coin;Dress coat;Comet;Kite;Dog
C|Words after tooth|tooth compounds;tooth|Pick;Paste;Ache;Fairy;Brush
S|Monopoly properties|Monopoly squares;Monopoly spaces;properties in Monopoly|Vermont Avenue;Water Works;Park Place;Boardwalk;Reading Railroad
W|Words ending in silent B|silent B endings;unpronounced final B;final B is silent|Lamb;Comb;Crumb;Limb;Thumb
C|Words before break|break compounds;break|Prison;Day;Heart;Ice;Coffee
T|Things with scales|objects with scales;scale bearers|Map;Model railway;Justice;Snake;Fish
C|Words before drop|drop compounds;drop|Name;Back;Gum;Rain;Tear
S|Constellations|star constellations;night sky constellations;stellar constellations|Phoenix;Dorado;Lyra;Cassiopeia;Orion
W|Words with at least three consecutive vowels|three vowels in a row;three adjacent vowels;triple vowel words|Beauty;Queueing;Radioactive;Delicious;Seeing
C|Words after water|water compounds;water|Mark;Shed;Melon;Fall;Proof
T|Things with faces|objects with faces;faced objects|Cliff;Diamond;Cube;Clock;Person
S|Beatles songs|songs by the Beatles;Beatles tracks;the Beatles music|Help;Something;Yesterday;Hey Jude;Yellow Submarine
W|QU pronounced like K|QU sounding like K;K sound spelled QU;hard QU sound|Quay;Bouquet;Antique;Liquor;Mosquito
S|Famous ships|named ships;historic ships;well known vessels|Discovery;Victory;Endeavour;Mayflower;Titanic
C|Words before jack|jack compounds;jack|Apple;Union;Lumber;Flap;Black
T|Things with blades|objects with blades;bladed objects|Grass;Turbine;Oar;Skate;Razor
C|Words after butter|butter compounds;butter|Fingers;Cup;Scotch;Milk;Fly
S|Currencies|world currencies;units of money;monetary units|Crown;Rand;Won;Peso;Yen
W|Words using only the top keyboard row|top row keyboard words;QWERTY top row;top row letters only|Perpetuity;Repertoire;Proprietor;Pottery;Typewriter
C|Words after thunder|thunder compounds;thunder|Clap;Head;Cloud;Bolt;Storm
T|Things with roots|objects with roots;root bearers|Equation;Family;Molar;Seedling;Oak
C|Words before horse|horse compounds;horse|Dark;Saw;Clothes;Sea;Rocking
S|Olympic sports|sports at the Olympics;Olympic disciplines;summer Olympic sports|Breaking;Trampoline;Handball;Fencing;Decathlon
W|Words using only the left hand on a keyboard|left hand typing words;left hand QWERTY;left hand keyboard words|Stewardess;Sweater;Cabbage;Afterward;Watercress
C|Words after moon|moon compounds;moon|Rock;Beam;Shine;Light;Landing
T|Things with branches|objects with branches;branching things|Bank;Government;Mathematics;River;Oak tree
C|Words before fish|fish compounds;fish|Silver;Sword;Star;Jelly;Gold
S|Shades of blue|blue shades;blue colors;blue hues|Alice;Steel;Powder;Cobalt;Navy
W|Words using only the right hand on a keyboard|right hand typing words;right hand QWERTY;right hand keyboard words|Minimum;Onion;Lollipop;Monopoly;Hunky
C|Words after hand|hand compounds;hand|Shake;Stand;Cuff;Bag;Writing
T|Things with trunks|objects with trunks;trunk bearers|Swimmer;Car;Oak;Redwood;Elephant
S|Shakespeare plays|plays by Shakespeare;Shakespeare works;Shakespeare dramas|The Tempest;Twelfth Night;Othello;Hamlet;Macbeth
W|Words with letters in alphabetical order|alphabetically ordered words;letters ascending alphabetically;alphabetical letter order;alphabetical order|Almost;Chintz;Begins;Biopsy;Abhors
S|Musical tempo markings|tempo terms;music speed directions;Italian tempo markings|Grave;Largo;Andante;Allegro;Presto
C|Words before man|man compounds;man|Straw;Gingerbread;Snow;Post;Fire
T|Things with ribs|objects with ribs;ribbed objects|Celery;Umbrella;Boat;Radiator;Skeleton
C|Words after foot|foot compounds;foot|Note;Print;Step;Path;Wear
S|Ice cream flavors|ice cream varieties;flavors of ice cream;ice cream|Rocky road;Birthday cake;Pistachio;Mint chip;Vanilla
W|Words with repeated halves|same half twice;repeated letter blocks;identical halves|Couscous;Bonbon;Murmur;Tutu;Mama
C|Words before cut|cut compounds;cut|Budget;Short;Crew;Hair;Price
T|Things with heels|objects with heels;heel bearers|Bread loaf;Golf club;Hand;Sock;Stiletto
C|Words after day|day compounds;day|Dream;Care;Break;Time;Trip
S|Car models|automobile models;vehicle models;model names of cars|Focus;Mustang;Civic;Corolla;Camry
W|Words that rhyme with blue|blue rhymes;rhymes of blue;rhyming with blue;rhymes with blue|Queue;Anew;Through;Shoe;Glue
C|Words before work|work compounds;work|Ground;Net;Frame;Team;Home
T|Things with noses|objects with noses;nose bearers|Wine;Bullet;Aircraft;Snowman;Face
C|Words after head|head compounds;head|Count;Quarters;Ache;Band;Phones
S|Garden flowers|flower varieties;flowering garden plants;flowers|Stock;Heather;Iris;Dahlia;Daffodil
W|Rhymes with the number after seven|eight rhymes;rhymes of eight;rhyming with eight;rhymes with eight|Straight;Freight;Weight;Great;Plate
C|Words before room|room compounds;room|Leg;Elbow;Mush;Class;Bath
T|Things with dials|objects with dials;dial bearers|Safe;Radio;Oven;Thermostat;Clock
S|Mushroom varieties|types of mushrooms;edible mushroom types;mushrooms|Oyster;Lion's mane;Chicken of the woods;Shiitake;Portobello
W|Words containing all five vowels|all vowels appear;words with every vowel;five different vowels|Education;Sequoia;Equivocal;Automobile;Facetious
S|Ways to swim|swimming strokes;swim strokes;strokes in swimming;swimming styles|Sidestroke;Dog paddle;Butterfly;Backstroke;Breaststroke
C|Words after blue|blue compounds;blue|Blood;Collar;Jay;Ribbon;Berry
T|Things with caps|objects with caps;cap wearers|Mushroom;Toothpaste;Pen;Knee;Graduate
C|Words before bell|bell compounds;bell|Diving;Dumb;Bar;Cow;Door
S|Gymnastics apparatus|gymnastics equipment;artistic gymnastics apparatus;gymnastics stations|Rings;Vault;Floor;Pommel horse;Balance beam
W|Words without A, E, I, O or U|no A E I O U;words without vowels;only Y as vowel|Crypt;Tryst;Lymph;Rhythm;Myth
C|Words after black|black compounds;black|Mail;Out;Smith;Bird;Berry
T|Things with feet|objects with feet;foot bearers|Poem;Mountain;Bedstead;Tripod;Penguin
C|Words before time|time compounds;time|Prime;Spare;Half;Bed;Lunch
S|Types of hats|hats;headwear styles;hat styles|Porkpie;Boater;Trilby;Beret;Sombrero
W|Words ending in a double consonant|double consonant endings;two identical consonants at the end;doubled final consonants|Jazz;Buzz;Staff;Fuzz;Chess
C|Words after rain|rain compounds;rain|Check;Maker;Forest;Coat;Bow
T|Things with legs|objects with legs;leg bearers|Journey;Right triangle;Wine glass;Trousers;Table
C|Words before mark|mark compounds;mark|Bench;Land;Question;Birth;Trade
S|Playing card ranks|card ranks;ranks in a deck;standard card values|Jack;Queen;King;Ten;Ace
W|Words that reverse into other words|reversed word pairs;words spelled backwards form new words;reverse spelling words|Stressed;Drawer;Reward;Live;Stop
C|Words after star|star compounds;star|Struck;Gazer;Dust;Board;Ship
T|Things with hearts|objects with hearts;heart bearers|Artichoke;Deck of cards;City;Palm tree;Person
S|Time zones|time zone names;standard time zones;global time zones|Mountain;Central;Eastern;Pacific;GMT
W|Nouns and verbs with different stress|noun verb stress shifts;stress changing noun verb pairs;noun verb stress changes|Object;Permit;Record;Present;Conduct
S|Film genres|movie genres;cinema genres;types of films|Western;Noir;Thriller;Musical;Horror
C|Words before wheel|wheel compounds;wheel|Hamster;Prayer;Potter's;Ferris;Steering
T|Things with arms|objects with arms;arm bearers|Galaxy;Chair;Record player;Coat;Octopus
C|Words after sun|sun compounds;sun|Dog;Dial;Flower;Screen;Rise
S|Tools in a toolbox|hand tools;workshop tools;common manual tools|Plane;Level;File;Chisel;Hammer
W|Words hiding spelled-out numbers|hidden number names;numbers inside words;spelled out numbers inside words|Alone;Freight;Someone;Threesome;Fourfold
C|Words before proof|proof compounds;proof|Fool;Idiot;Bullet;Sound;Water
T|Things with sleeves|objects with sleeves;sleeved objects|Record;Laptop;Coffee cup;Tattoo;Jacket
C|Words after air|air compounds;air|Guitar;Mail;Port;Craft;Plane
S|Kinds of beans|bean varieties;types of beans;beans;bean types|Runner;Navy;Kidney;Pinto;Black-eyed pea
W|Words using A as their only vowel|only A vowels;A is the sole vowel;A only vowel words|Abracadabra;Almanac;Banana;Canal;Pajamas
C|Words before coat|coat compounds;coat|Sugar;Under;Over;Waist;Rain
T|Things with belts|objects with belts;belt wearers|Solar system;Conveyor;Treadmill;Car engine;Trousers
C|Words after sand|sand compounds;sand|Man;Stone;Blaster;Box;Castle
S|Types of dances|dance styles;social dances;dances|Swing;Hustle;Reel;Foxtrot;Waltz
W|Unchanged singular and plural spellings|same singular and plural;identical singular and plural;invariant plurals|Species;Series;Salmon;Sheep;Deer
C|Words before walk|walk compounds;walk|Cat;Cake;Board;Moon;Side
T|Things with seals|objects with seals;seal bearers|Treaty;Envelope;Jar;Passport;Aquarium
S|Shoe styles|types of shoes;footwear styles;shoes|Mule;Oxford;Slingback;Loafer;Stiletto
W|Plurals ending in en|en plurals;plural words with en;en ending plurals|Brethren;Oxen;Children;Men;Women
S|Tennis scoring terms|tennis scores;scoring in tennis;tennis point calls|Love;Advantage;Deuce;Thirty;Forty
C|Words after gold|gold compounds;gold|Rush;Digger;Leaf;Smith;Fish
T|Things with chambers|objects with chambers;chamber bearers|Parliament;Revolver;Nautilus;Airlock;Human heart
C|Words before pot|pot compounds;pot|Jack;Crack;Honey;Tea;Coffee
S|Types of cheese|cheese varieties;cheeses;cheese names|Cottage;Pepper jack;Swiss;Brie;Cheddar
W|American spellings that differ from British|US spellings;American versus British spelling;American English spellings|Tire;Color;Neighbor;Center;Theater
C|Words after ice|ice compounds;ice|Cap;Age;Pick;Berg;Cream
T|Things with cells|objects with cells;cell bearers|Spreadsheet;Honeycomb;Prison;Solar panel;Organism
C|Words before bag|bag compounds;bag|Mixed;Punching;Bean;Sleeping;Hand
S|File hosting platforms|online storage services;file hosting services;cloud file storage|Box;Drive;OneDrive;Dropbox;iCloud
W|O endings that take es in the plural|O words taking es plurals;es plurals of O words;O ending es plurals|Echo;Torpedo;Veto;Tomato;Potato
C|Words after life|life compounds;life|Line;Time;Guard;Boat;Jacket
T|Things with strings|objects with strings;string bearers|Puppet;Tennis racket;Hoodie;Harp;Violin
C|Words before fall|fall compounds;fall|Pit;Night;Down;Free;Water
S|Famous detectives|fictional detectives;detective characters;literary detectives|Magnum;Columbo;Marple;Poirot;Sherlock Holmes
W|Compounds starting with body parts|body part compounds;body parts at the start of compounds;anatomical compound words|Handstand;Footnote;Toothpick;Earbud;Headache
C|Words after back|back compounds;back|Stroke;Ground;Pack;Bone;Yard
T|Things with springs|objects with springs;spring bearers|Desert oasis;Trampoline;Mousetrap;Mattress;Pogo stick
S|Board games|tabletop board games;games played on boards;board based games|Risk;Sorry;Clue;Scrabble;Monopoly
W|Words hiding foods|hidden food names;foods inside words;embedded food words|Champagne;Sherbet;Steward;Orchard;Hamburger
S|Adobe software|Adobe apps;Adobe programs;Adobe products|Bridge;Audition;Acrobat;Illustrator;Photoshop
C|Words before brush|brush compounds;brush|Bottle;Air;Paint;Hair;Scrub
T|Things with needles|objects with needles;needle bearers|Compass;Record player;Fir;Syringe;Sewing kit
C|Words after cross|cross compounds;cross|Examine;Word;Bow;Road;Walk
S|Apple products|Apple devices;products made by Apple;Apple hardware|Lisa;Newton;Watch;Macintosh;iPhone
W|Homophones of foods|food soundalikes;words sounding like foods;food homophones|Leak;Pair;Beat;Flower;Muscles
C|Words before roll|roll compounds;roll|Honor;Bread;Eye;Cinnamon;Sushi
T|Things with windows|objects with windows;window bearers|Opportunity;Envelope;Computer;Advent calendar;Building
C|Words after sea|sea compounds;sea|Change;Horse;Weed;Food;Lion
S|Human bones|bones in the body;skeletal bones;names of bones|Radius;Ulna;Patella;Femur;Tibia
W|Homophones of animals|animal soundalikes;words sounding like animals;animal homophones|Flee;Wail;Hoarse;Dear;Bare
C|Words before mill|mill compounds;mill|Rumor;Tread;Pepper;Steel;Wind
T|Things with shells|objects with shells;shell bearers|Operating system;Atom;Taco;Egg;Turtle
C|Words after wind|wind compounds;wind|Chime;Chill;Fall;Shield;Mill
S|Types of triangles|triangle classifications;triangle varieties;triangles|Acute;Obtuse;Scalene;Isosceles;Equilateral
W|Homophones of body parts|body part soundalikes;words sounding like body parts;anatomical homophones|Waste;Feat;Tow;Heal;I
C|Words before school|school compounds;school|Old;Finishing;Night;Boarding;High
T|Things with bridges|objects with bridges;bridge bearers|Song;Glasses;Violin;Nose;Canal
S|Astronomical objects|celestial objects;natural space objects;celestial bodies|Brown dwarf;Pulsar;Quasar;Nebula;Galaxy
W|Words starting with solfege syllables|solfege prefixes;do re mi prefixes;musical syllables at the start|Domino;Retreat;Miracle;Fable;Solid
S|Web browsers|internet browsers;browser applications;web browsing programs|Brave;Edge;Opera;Safari;Firefox
C|Words after news|news compounds;news|Flash;Stand;Room;Letter;Paper
T|Things with barrels|objects with barrels;barrel bearers|Wave;Fountain pen;Syringe;Revolver;Winery
C|Words before point|point compounds;point|Tipping;Boiling;Turning;Match;Decimal
S|Famous musicals|stage musicals;Broadway musicals;musical theater shows|Company;Chicago;Carousel;Wicked;Les Misérables
W|Plurals made by changing vowels|vowel changing plurals;internal vowel plurals;plurals with vowel changes|Mouse;Goose;Louse;Man;Tooth
C|Words after tea|tea compounds;tea|Towel;Party;Spoon;Pot;Bag
T|Things that can be drawn|drawable things;things you can draw|Conclusion;Breath;Bath;Curtain;Picture
C|Words before stick|stick compounds;stick|Joy;Yard;Broom;Glow;Chop
S|Rowing terms|rowing vocabulary;rowing jargon;crew terminology|Catch;Feather;Crab;Stroke;Coxswain
W|Words spellable on an upside-down calculator|calculator words;upside down calculator spelling;calculator spelling|Goggle;Leg;Oil;Shell;Hello
C|Words after door|door compounds;door|Step;Mat;Stop;Knob;Bell
T|Things that can be struck|strikable things;things you can strike|Deal;Balance;Chord;Match;Gong
C|Words before top|top compounds;top|Tank;Lap;Counter;Table;Roof
S|Things in a first aid kit|first aid supplies;medical kit contents;emergency medical supplies|Gloves;Scissors;Gauze;Tweezers;Bandage
W|One ending with five pronunciations|ough endings;ough words;words with ough at the end;different ough sounds|Bough;Dough;Cough;Through;Rough
C|Words after space|space compounds;space|Bar;Walk;Ship;Suit;Station
T|Things that can be cracked|crackable things;things you can crack|Joke;Code;Case;Whip;Egg
S|National parks in the USA|US national parks;American national parks;United States national parks|Olympic;Glacier;Acadia;Yosemite;Yellowstone
W|CH pronounced like K|CH sounding like K;K sound spelled CH;hard CH sound|Chaos;Echo;School;Chorus;Chemistry
S|Types of coffee drinks|coffee drinks;espresso drinks;café drinks|Flat white;Long black;Cortado;Cappuccino;Latte
C|Words before shot|shot compounds;shot|Long;Mug;Snap;Sling;Slap
T|Things that can be served|servable things;things you can serve|Notice;Sentence;Tennis ball;Customer;Meal
C|Words after finger|finger compounds;finger|Food;Paint;Tip;Nail;Print
S|Types of peppers|pepper varieties;chili peppers;peppers|Ghost;Scotch bonnet;Poblano;Habanero;Jalapeño
W|Words with matching first and last letters|same first and last letter;matching end letters;same letter at both ends|Aroma;Bulb;Chic;Dread;Eagle
C|Words before land|land compounds;land|Wonder;Waste;High;Main;Disney
T|Things that can be folded|foldable things;things you can fold|Poker hand;Arms;Omelet;Laundry;Paper
C|Words after ear|ear compounds;ear|Drum;Worm;Bud;Plug;Ring
S|Types of rock|rock classifications;geological rock types;rocks|Chalk;Slate;Basalt;Marble;Granite
W|Words hiding three consecutive alphabet letters|alphabet triples;embedded alphabet sequences;three consecutive letters inside words|Hijack;Nope;Calmness;Defend;Stupid`;

let bank: PinpointPuzzle[] | undefined;
export function pinpointPuzzles(): PinpointPuzzle[] {
  return (bank ??= PINPOINT_DATA.split('\n').map((line, index) => {
    const [kind, category, accepted, clues, reject = ''] = line.split('|');
    const compound = /^Words (before|after) (.+)$/.exec(category);
    const variants = compound
      ? [
          `${compound[2]} words`,
          `things ${compound[1]} ${compound[2]}`,
          `words ${compound[1] === 'before' ? 'preceding' : 'following'} ${compound[2]}`,
          `compound words ${compound[1] === 'before' ? 'with' : 'starting with'} ${compound[2]}`,
        ]
      : [];
    return {
      kind: kind as PinpointPuzzle['kind'],
      category,
      accepted: [...new Set([category, ...accepted.split(';'), ...variants])],
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
