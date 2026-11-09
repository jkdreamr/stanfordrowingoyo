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
export const PINPOINT_DATA = `b|ball|Crystal;Cotton;Snow;Basket;Foot
S|Pixar movies|Pixar films;Pixar;Disney Pixar movies|Up;Soul;Cars;Brave;Toy Story
t|keys|Map;Florida;Cipher;Piano;Lock
a|book|Worm;End;Mark;Shelf;Case
S|Types of knots|knots;rope knots;rope ties|Granny;Sheepshank;Clove hitch;Bowline;Square
t|tongues|Buckle;Flame;Bell;Shoe;Mouth
b|light|Bud;Lime;Spot;Flash;Sun
S|Chess pieces|chessmen;pieces in chess;chess units|Rook;Bishop;Knight;Queen;Pawn
a|pocket|Change;Lint;Knife;Book;Money
S|Card games|playing card games;games with cards;card based games|Concentration;War;Hearts;Bridge;Poker
t|crowns|Pineapple;Road;Tooth;Tree;Monarch
b|house|Round;Green;Ware;Light;Bird
S|Cloud formations|cloud types;meteorological clouds;kinds of clouds|Anvil;Lenticular;Cirrus;Cumulus;Stratus
a|fire|Fly;Escape;Place;Fighter;Wood
S|NATO alphabet words|NATO phonetic alphabet;military spelling alphabet;phonetic alphabet|Hotel;Golf;Juliett;Whiskey;Alpha
t|rings|Bathtub;Tree;Circus;Telephone;Saturn
b|bed|Oyster;Truck;Garden;River;Hospital
S|Pasta shapes|pasta varieties;types of pasta;pasta|Shells;Wheels;Elbows;Bow ties;Spaghetti
b|board|Sound;Spring;Drawing;Skate;Surf
S|Greek letters|Greek alphabet;letters of Greek;Greek alphabet letters|Delta;Mu;Pi;Sigma;Omega
t|necks|Isthmus;Guitar;Bottle;Shirt;Giraffe
a|brain|Wave;Child;Storm;Wash;Teaser
S|Dog breeds|breeds of dog;canine breeds;dogs|Boxer;Pointer;Chow chow;Beagle;Poodle
b|cake|Crab;Sponge;Fruit;Pan;Cheese
S|Cocktails|mixed alcoholic drinks;cocktail drinks;bar cocktails|Aviation;Sidecar;Grasshopper;Negroni;Margarita
t|spines|Cactus;Book;Sea urchin;Porcupine;Vertebrate
a|silver|Screen;Lining;Tongue;Medal;Ware
S|Monopoly properties|Monopoly squares;Monopoly spaces;properties in Monopoly|Vermont Avenue;Water Works;Park Place;Boardwalk;Reading Railroad
b|line|Punch;Clothes;Coast;Finish;Under
S|Constellations|star constellations;night sky constellations;stellar constellations|Phoenix;Dorado;Lyra;Cassiopeia;Orion
t|teeth|Gear;Zipper;Saw;Comb;Shark
b|pitch|Perfect;Sales;Fever;Football;Elevator
S|Beatles songs|songs by the Beatles;Beatles tracks;the Beatles music|Help;Something;Yesterday;Hey Jude;Yellow Submarine
t|handles|Username;Bicycle;Suitcase;Pan;Door
a|rubber|Stamp;Plant;Band;Duck;Ball
S|Famous ships|named ships;historic ships;well known vessels|Discovery;Victory;Endeavour;Mayflower;Titanic
t|tails|Coin;Airplane;Comet;Kite;Dog
b|stone|Touch;Mile;Honey;Lime;Gem
S|Currencies|world currencies;units of money;monetary units|Crown;Rand;Won;Peso;Yen
a|tooth|Pick;Paste;Ache;Fairy;Brush
S|Olympic sports|sports at the Olympics;Olympic disciplines;summer Olympic sports|Breaking;Trampoline;Handball;Fencing;Decathlon
t|scales|Map;Blueprint;Justice;Snake;Fish
b|break|Prison;Day;Fast;Ice;Coffee
S|Shades of blue|blue shades;blue colors;blue hues|Alice;Steel;Powder;Cobalt;Navy
b|drop|Name;Back;Gum;Rain;Tear
S|Shakespeare plays|plays by Shakespeare;Shakespeare works;Shakespeare dramas|The Tempest;Twelfth Night;Othello;Hamlet;Macbeth
t|faces|Cliff;Diamond;Cube;Clock;Person
a|water|Mark;Shed;Melon;Fall;Proof
S|Musical tempo markings|tempo terms;music speed directions;Italian tempo markings|Grave;Largo;Andante;Allegro;Presto
b|jack|Apple;Union;Lumber;Flap;Jumping
S|Ice cream flavors|ice cream varieties;flavors of ice cream;ice cream|Rocky road;Birthday cake;Pistachio;Mint chip;Vanilla
t|blades|Grass;Turbine;Oar;Skate;Razor
a|butter|Fingers;Cup;Scotch;Milk;Fly
S|Car models|automobile models;vehicle models;model names of cars|Focus;Mustang;Civic;Corolla;Camry
a|thunder|Clap;Head;Cloud;Bolt;Storm
S|Garden flowers|flower varieties;flowering garden plants;flowers|Stock;Heather;Iris;Dahlia;Daffodil
t|roots|Equation;Family;Molar;Seedling;Oak
b|horse|Dark;Saw;Clothes;Sea;Rocking
S|Mushroom varieties|types of mushrooms;edible mushroom types;mushrooms|Oyster;Lion's mane;Morel;Shiitake;Portobello
a|micro|Scope;Wave;Chip;Fiber;Organism
S|Ways to swim|swimming strokes;swim strokes;strokes in swimming;swimming styles|Sidestroke;Dog paddle;Butterfly;Backstroke;Breaststroke
t|hoods|Cobra;Kitchen;Stroller;Monk;Sweatshirt
b|fish|Silver;Sword;Star;Jelly;Gold
S|Gymnastics apparatus|gymnastics equipment;artistic gymnastics apparatus;gymnastics stations|Rings;Vault;Floor;Pommel horse;Balance beam
t|trunks|Swimmer;Convertible;Oak;Redwood;Elephant
a|hand|Shake;Stand;Cuff;Bag;Writing
S|Types of hats|hats;headwear styles;hat styles|Porkpie;Boater;Derby;Beret;Sombrero
W|Hidden colors|colors inside words;hidden colours|Bred;Incredible;Brownie;Blueprint;Evergreen
b|man|Straw;Gingerbread;Snow;Post;Fire
S|Playing card ranks|card ranks;ranks in a deck;standard card values|Jack;Queen;King;Ten;Ace
a|foot|Note;Print;Step;Path;Wear
S|Time zones|time zone names;standard time zones;global time zones|Mountain;Central;Eastern;Pacific;GMT
t|ribs|Celery;Umbrella;Canoe;Radiator;Skeleton
b|cut|Budget;Short;Crew;Hair;Price
S|Film genres|movie genres;cinema genres;types of films|Western;Noir;Thriller;Musical;Horror
a|day|Dream;Care;Break;Time;Trip
S|Tools in a toolbox|hand tools;workshop tools;common manual tools|Plane;Level;File;Chisel;Hammer
W|Letter homophones|letter soundalikes;words sounding like letters|Sea;Queue;Tea;Why;Bee
b|work|Ground;Net;Frame;Team;Home
S|Kinds of beans|bean varieties;types of beans;beans;bean types|Runner;Navy;Kidney;Pinto;Black-eyed pea
a|head|Count;Quarters;Ache;Band;Phones
S|Types of dances|dance styles;social dances;dances|Swing;Hustle;Reel;Foxtrot;Waltz
t|heels|Bread;Putter;Runner;Sock;Stiletto
b|room|Leg;Elbow;Mush;Class;Bath
S|Shoe styles|types of shoes;footwear styles;shoes|Mule;Oxford;Slingback;Loafer;Stiletto
a|blue|Blood;Collar;Jay;Ribbon;Berry
S|Tennis scoring terms|tennis scores;scoring in tennis;tennis point calls|Love;Advantage;Deuce;Thirty;Forty
W|Hidden animals|animals inside words;embedded animal names|Scarp;Scattered;Cowl;Beeline;Dogma
b|bell|Diving;Dumb;Bar;Cow;Door
S|Types of cheese|cheese varieties;cheeses;cheese names|Cottage;Pepper jack;Swiss;Brie;Cheddar
a|black|Mail;Out;Smith;Bird;Berry
S|File hosting platforms|online storage services;file hosting services;cloud file storage|Box;Drive;OneDrive;Dropbox;iCloud
t|noses|Wine;Bullet;Aircraft;Snowman;Face
b|time|Prime;Spare;Half;Bed;Lunch
S|Famous detectives|fictional detectives;detective characters;literary detectives|Magnum;Columbo;Marple;Poirot;Sherlock Holmes
W|Palindromes|same backwards;words reading both ways|Deified;Rotator;Kayak;Racecar;Radar
a|rain|Check;Maker;Forest;Coat;Bow
S|Board games|tabletop board games;games played on boards;board based games|Risk;Sorry;Clue;Scrabble;Monopoly
t|dials|Safe;Radio;Oven;Thermostat;Clock
b|mark|Bench;Land;Question;Birth;Trade
S|Adobe software|Adobe apps;Adobe programs;Adobe products|Bridge;Audition;Acrobat;Illustrator;Photoshop
a|star|Struck;Gazer;Dust;Board;Ship
W|Roman numeral words|Roman letter words;only Roman numeral letters|Mix;Civil;Mild;Livid;Mill
t|caps|Mushroom;Toothpaste;Pen;Knee;Graduate
b|wheel|Hamster;Prayer;Potter's;Ferris;Steering
S|Apple products|Apple devices;products made by Apple;Apple hardware|Lisa;Newton;Watch;Macintosh;iPhone
a|sun|Dog;Dial;Flower;Screen;Rise
W|Silent letters|words with silent letters;unpronounced letters|Heir;Lamb;Comb;Gnome;Knight
t|feet|Poem;Mountain;Sofa;Tripod;Penguin
b|proof|Fool;Idiot;Bullet;Sound;Water
S|Human bones|body bones;skeletal bones|Hammer;Anvil;Stirrup;Femur;Skull
a|air|Guitar;Mail;Port;Craft;Plane
W|Add S in front|add an S;S prefix;add S to the start|Laughter;Lumber;Lash;Pin;Tar
t|legs|Journey;Compass;Cricket;Pants;Table
b|coat|Sugar;Under;Over;Waist;Rain
S|Types of triangles|triangle classifications;triangle varieties;triangles|Acute;Obtuse;Scalene;Isosceles;Equilateral
a|sand|Man;Stone;Blaster;Box;Castle
W|Instrument homophones|musical homophones;instruments that sound alike|Symbol;Base;Loot;Liar;Sacks
t|hearts|Artichoke;Deck;City;Palm;Person
b|walk|Cat;Cake;Board;Moon;Side
S|Astronomical objects|celestial objects;natural space objects;celestial bodies|Comet;Pulsar;Quasar;Nebula;Galaxy
a|gold|Rush;Digger;Leaf;Smith;Fish
W|Number homophones|numbers that sound alike;numeral soundalikes|Won;To;Fore;Ate;Forth
t|arms|Galaxy;Chair;Turntable;Coat;Octopus
b|pot|Jack;Crack;Honey;Tea;Coffee
S|Web browsers|internet browsers;browser applications;web browsing programs|Brave;Edge;Opera;Safari;Firefox
W|Onomatopoeia|sound words;words imitating sounds|Rustle;Clang;Buzz;Splash;Bang
a|ice|Cap;Age;Pick;Berg;Cream
t|sleeves|Record;Laptop;Cup;Tattoo;Jacket
S|Famous musicals|stage musicals;Broadway musicals;musical theater shows|Company;Chicago;Carousel;Wicked;Les Misérables
b|bag|Mixed;Punching;Bean;Sleeping;Hand
W|Birds that are verbs|bird verbs;bird names used as verbs|Grouse;Crow;Crane;Swallow;Duck
a|life|Line;Time;Guard;Boat;Style
t|belts|Jupiter;Conveyor;Treadmill;Engine;Pants
S|Rowing terms|rowing vocabulary;rowing jargon;crew terminology|Catch;Feather;Crab;Stroke;Coxswain
b|fall|Pit;Night;Down;Free;Water
W|Contronyms|self opposite words;words with opposite meanings|Dust;Trim;Seed;Cleave;Sanction
a|back|Stroke;Ground;Pack;Bone;Yard
t|seals|Treaty;Envelope;Jar;Passport;Aquarium
S|First aid supplies|first aid kit contents;medical kit supplies|Gloves;Scissors;Gauze;Tweezers;Bandage
b|brush|Toilet;Air;Paint;Hair;Scrub
W|Portmanteaus|blended words;word blends|Moped;Motel;Smog;Spork;Brunch
a|cross|Examine;Word;Bow;Country;Walk
t|chambers|Parliament;Revolver;Nautilus;Airlock;Heart
S|National parks in the USA|US national parks;American national parks;United States national parks|Olympic;Glacier;Acadia;Yosemite;Yellowstone
b|roll|Honor;Drum;Spring;Cinnamon;Sushi
W|Animal collective nouns|animal group names;collective animal names|Business;Murder;Parliament;Pride;Gaggle
a|sea|Change;Horse;Weed;Food;Lion
t|cells|Spreadsheet;Honeycomb;Prison;Panel;Organism
S|Types of coffee drinks|coffee drinks;espresso drinks;café drinks|Flat white;Mocha;Cortado;Cappuccino;Latte
b|mill|Rumor;Tread;Pepper;Steel;Wind
W|Words from place names|place name words;words named after places|Denim;Bikini;Champagne;Calico;Cashmere
a|wind|Chime;Chill;Fall;Shield;Mill
t|strings|Puppet;Racket;Hoodie;Harp;Violin
S|Types of peppers|pepper varieties;chili peppers;peppers|Ghost;Scotch bonnet;Poblano;Habanero;Jalapeño
b|school|Old;Finishing;Night;Boarding;Primary
W|Repeated halves|same half twice;repeated letter blocks|Couscous;Bonbon;Murmur;Tutu;Mama
t|springs|Oasis;Trampoline;Mousetrap;Mattress;Pogo stick
a|news|Flash;Stand;Room;Letter;Paper
S|Types of rock|rock classifications;geological rock types;rocks|Chalk;Slate;Basalt;Marble;Granite
W|Rhymes with blue|blue rhymes;rhyming with blue|Queue;Anew;Through;True;Glue
b|point|Tipping;Boiling;Turning;Match;Decimal
t|needles|Compass;Turntable;Fir;Syringe;Pincushion
a|tea|Towel;Party;Spoon;Pot;Bag
S|National capitals|capital cities;country capitals|Victoria;Amman;Ottawa;Rome;Paris
W|Words named after people|eponyms;words from personal names|Boycott;Cardigan;Leotard;Diesel;Sandwich
b|stick|Joy;Yard;Broom;Glow;Chop
t|windows|Opportunity;Envelope;Computer;Cockpit;Building
a|door|Step;Mat;Stop;Knob;Frame
S|US states|American states;states of the USA|Georgia;Washington;Montana;Alaska;California
W|All five vowels|words with all vowels;words containing every vowel|Education;Sequoia;Equivocal;Automobile;Facetious
b|top|Tank;Lap;Counter;Hill;Roof
t|shells|Terminal;Atom;Taco;Egg;Turtle
a|space|Bar;Walk;Ship;Suit;Station
S|Canadian provinces|provinces of Canada;Canada provinces|Alberta;Nova Scotia;Manitoba;Ontario;Quebec
W|No-vowel words|words without vowels;no A E I O U|Crypt;Tryst;Lymph;Rhythm;Myth
b|shot|Long;Mug;Snap;Sling;Slap
t|bridges|Song;Glasses;Violin;Nose;Canal
a|finger|Puppet;Paint;Tip;Nail;Print
S|African countries|African nations;countries in Africa|Chad;Guinea;Gabon;Kenya;Egypt
W|Jobs that are verbs|job verbs;occupations used as verbs|Judge;Tailor;Coach;Guide;Nurse
b|land|Wonder;Waste;High;Main;Disney
t|barrels|Lens;Ballpoint;Syringe;Revolver;Winery
a|ear|Drum;Worm;Bud;Plug;Ring
S|Island nations|island countries;countries that are islands|Malta;Dominica;Iceland;Madagascar;Japan
W|Reversible words|reverse spelling words;words backwards make words|Stressed;Drawer;Reward;Live;Stop
a|paper|Clip;Weight;Cut;Back;Work
v|drawn/draw|Conclusion;Breath;Bath;Curtain;Picture
S|Mountain ranges|mountain chains;mountain systems|Atlas;Brooks;Rockies;Andes;Himalayas
a|steam|Engine;Roller;Boat;Room;Locomotive
W|Homographs|heteronyms;words with different pronunciations|Bass;Row;Lead;Wind;Tear
v|struck/strike|Deal;Balance;Chord;Match;Gong
b|wood|Drift;Balsa;Hard;Soft;Fire
S|Deserts|arid regions;desert regions|Mojave;Great Basin;Atacama;Gobi;Sahara
a|earth|Mover;Quake;Bound;Work;Day
W|Hidden fruits|fruits inside words;embedded fruit names|Figment;Appear;Sublime;Peachy;Grapevine
v|cracked/crack|Joke;Code;Case;Whip;Egg
a|milk|Shake;Jug;Maid;White;Chocolate
S|Rivers|river names;major rivers|Orange;Snake;Po;Danube;Nile
b|care|Skin;Home;Health;After;Intensive
W|Hidden body parts|body parts inside words;embedded body parts|Yearn;Disarm;Chestnut;Hearten;Mouthful
v|served/serve|Notice;Sentence;Volleyball;Customer;Meal
b|set|Jet;Sun;Film;Mind;Television
S|Oceans|world oceans;Earth oceans|Southern;Indian;Arctic;Atlantic;Pacific
a|snow|Flake;Ball;Man;Mobile;Plow
W|Hidden clothing|clothes inside words;embedded clothing names|Hatchery;Capable;Address;Shortstop;Coattail
v|folded/fold|Hand;Arms;Omelet;Laundry;Paper
b|box|Soap;Letter;Music;Glove;Tool
S|Great Lakes|North American Great Lakes;the five Great Lakes|Superior;Huron;Erie;Ontario;Michigan
a|beach|Wear;Chair;Towel;Umbrella;Volleyball
W|Hidden furniture|furniture inside words;embedded furniture names|Stable;Bedlam;Chairman;Stoolpigeon;Benchwarmer
t|tips|Waiter;Iceberg;Pen;Arrow;Spear
a|cat|Gut;Call;Suit;Nap;Flap
S|Greek gods|Greek deities;gods of Greece|Iris;Nike;Hermes;Apollo;Zeus
a|over|Look;Load;Drive;Cook;Flow
W|Hidden metals|metals inside words;embedded metal names|Martini;Irony;Leadership;Goldfish;Silverware
t|pads|Goalie;Brake;Paw;Helmet;Headphones
a|under|Tone;Take;Study;Pass;Cover
S|Norse gods|Norse deities;gods of Norse mythology|Balder;Freya;Loki;Odin;Thor
W|Hidden drinks|drinks inside words;embedded drink names|Rumor;Twine;Meadow;Pale;Teamwork
b|end|Week;Dead;Rear;Front;Deep
t|tracks|Album;Animal;Curtain;Tank;Railway
S|Planetary moons|moons;natural satellites|Miranda;Ariel;Titan;Europa;Ganymede
a|super|Market;Bowl;Power;Star;Hero
W|Body-part idioms|anatomical idioms;body part expressions|Cold shoulder;Sweet tooth;Gut feeling;Poker face;Elbow grease
b|way|Fair;Sub;Run;Park;Motor
t|bands|Jupiter;Spectrum;Cigar;Wedding;Hat
S|Apple varieties|apple cultivars;types of apples|Fuji;Gala;Jazz;Braeburn;Granny Smith
a|camp|Site;Counselor;Song;Stove;Cot
W|Hidden foods|foods inside words;embedded food names|Champagne;Sherbet;Steward;Orchard;Hamburger
a|bath|Salt;Tub;Robe;Mat;Bomb
t|bars|Signal;Chocolate;Jail;Music;Pub
S|Citrus fruits|citrus varieties;types of citrus|Clementine;Bergamot;Pomelo;Orange;Lemon
a|post|Card;Office;Script;Season;Graduate
W|Homophones of foods|food soundalikes;words sounding like foods;food homophones|Leak;Pair;Beat;Flower;Muscles
a|counter|Point;Part;Balance;Weight;Attack
t|threads|Story;Forum;Screw;Bolt;Spool
S|Baking ingredients|baking basics;ingredients for baking|Shortening;Cornstarch;Cocoa;Flour;Yeast
a|fore|Cast;Arm;Front;Sail;Sight
W|Homophones of animals|animal soundalikes;words sounding like animals;animal homophones|Flee;Wail;Hoarse;Dear;Bare
b|ward|To;For;Out;Sky;Way
t|locks|Canal;Hairdo;Bicycle;Suitcase;Doorway
S|Herbs|culinary herbs;kitchen herbs|Bay;Sage;Rosemary;Thyme;Basil
a|baby|Grand;Sitter;Boom;Sit;Shower
W|Homophones of body parts|body part soundalikes;words sounding like body parts;anatomical homophones|Waste;Feat;Tow;Heal;I
a|green|House;Horn;Belt;Thumb;Light
t|menus|Phone;DVD;Game;Café;Restaurant
S|Spices|culinary spices;spice varieties|Mace;Clove;Cumin;Turmeric;Cinnamon
a|red|Carpet;Tape;Herring;Wing;Hot
W|Solfege beginnings|words starting with solfege;do re mi beginnings|Domino;Retreat;Miracle;Fable;Solid
t|pages|Website;Senate;Calendar;Notebook;Magazine
a|white|Cap;Wash;Lie;Noise;Flag
S|Salad greens|salad leaves;leafy salad vegetables|Chicory;Mustard;Watercress;Romaine;Lettuce
W|Irregular plurals|irregular plural nouns;nonstandard plurals|Mouse;Goose;Louse;Ox;Child
b|ache|Tooth;Muscle;Belly;Stomach;Ear
t|buttons|Belly;Elevator;Remote;Accordion;Cardigan
a|stop|Gap;Watch;Sign;Motion;Page
S|Candy bars|candy bar names;candy bar brands|PayDay;Milky Way;Crunch;Kit Kat;Snickers
W|Calculator words|upside down calculator words;calculator spelling|Goggle;Leg;Oil;Shell;Hello
a|hair|Pin;Cut;Net;Brush;Do
t|tabs|Browser;Songbook;Spreadsheet;Can;Folder
a|race|Course;Track;Car;Horse;Way
S|Cookies|biscuits;cookie varieties|Chessmen;Milano;Snickerdoodle;Chips Ahoy;Oreo
W|Hidden vehicles|vehicles inside words;embedded vehicle names|Scarcity;Bushel;Cartography;Trained;Boathouse
a|motor|Mouth;Sport;Race;Bike;Cycle
t|leaves|Table;Booklet;Rose;Fern;Maple
a|turn|Over;Around;Stile;Key;Pike
S|Breakfast cereals|cereals;breakfast cereal brands|Total;Life;Shredded Wheat;Corn Flakes;Cheerios
W|Everyday acronyms|acronyms;words made from initials|Sonar;Radar;Laser;Taser;Scuba
b|tower|Bell;Cooling;Cell;Ivory;Eiffel
t|mouths|River;Cave;Jug;Volcano;Baby
a|honey|Crisp;Dew;Moon;Bee;Pot
S|Soups|soup varieties;types of soup|Bisque;Bouillon;Gazpacho;Minestrone;Chowder
W|Pronoun homophones|pronouns that sound alike;pronoun soundalikes|Hymn;Hours;Whee;Ewe;Eye
a|pea|Hen;Shooter;Soup;Nut;Pod
t|holes|Argument;Alibi;Golf;Swiss;Sieve
a|out|Burst;Cast;Fit;Post;Law
S|Sandwiches|sandwich varieties;types of sandwich|Club;Reuben;Monte Cristo;BLT;Grilled cheese
W|Weather homophones|weather soundalikes;weather words that sound alike|Reign;Due;Hale;Missed;Son
a|in|Let;Land;Law;Put;Come
t|eyes|Potato;Hurricane;Needle;Peacock;Face
S|Pizza styles|types of pizza;pizza varieties|Detroit;Sicilian;Neapolitan;Margherita;Deep dish
b|yard|Vine;Grave;Court;Barn;School
W|Geographic homophones|geography homophones;place homophones|Straight;Creak;Aisle;Beech;See
t|channels|Television;Riverbed;Radio;YouTube;Walkie-talkie
b|fly|Sand;House;May;Dragon;Butter
S|Coffee chains|coffee shops;coffeehouse chains|Costa;Caribou;Peet's;Dunkin';Starbucks
a|drum|Stick;Beat;Roll;Kit;Major
W|French loanwords|French words;borrowed French words|Ballet;Encore;Genre;Croissant;Rendezvous
t|horns|Dilemma;Orchestra;Snail;Rhino;Bull
a|blood|Hound;Clot;Stream;Pressure;Type
S|Hotel chains|hotel brands;hospitality chains|Hilton;Hyatt;Sheraton;Marriott;Holiday Inn
a|pop|Up;Corn;Gun;Singer;Art
W|Hidden money units|hidden currencies;money units inside words|Cayenne;Wonky;Random;Poundcake;Centaur
t|chains|Anchor;Swing;DNA;Necklace;Motorcycle
b|nut|Chest;Dough;Hazel;Brazil;Pea
S|Airlines|air carriers;airline companies|Spirit;Frontier;Delta;Emirates;Qantas
a|auto|Graph;Mobile;Pilot;Biography;Focus
W|Hidden relatives|relatives inside words;embedded family members|Haunted;Unclear;Thermometer;Parenthesis;Godfather
t|fans|Celebrity;Team;Computer;Tunnel;Ceiling
a|pass|Word;Port;Key;Age;Through
S|Automakers|car manufacturers;car brands|Seat;Mini;Jaguar;Volvo;Toyota
b|print|Blue;Finger;Foot;News;Fine
W|Hidden professions|jobs inside words;embedded job names|Tailored;Prejudged;Autopilot;Butchery;Bakery
t|shoulders|Road;Bottle;Hanger;Jacket;Mannequin
b|play|Sword;Foul;Fair;Role;Power
S|Programming languages|coding languages;computer languages|Scratch;Rust;Ruby;Java;Python
a|field|Marshal;Test;Guide;Hockey;Goal
W|Hidden instruments|instruments inside words;embedded instrument names|Sharp;Cornetto;Absolute;Drummer;Bagpiper
t|wings|Party;Hospital;Theater;Airplane;Bat
b|boat|Show;Tug;Row;Life;Sail
S|Search engines|web search engines;internet search services|Bing;Ask;Ecosia;Yahoo;Google
W|Rhymes with red|red rhymes;rhyming with red|Bread;Said;Lead;Thread;Shed
b|court|Food;Tennis;Basketball;High;Supreme
t|pedals|Loom;Harp;Piano;Organ;Bike
S|Messaging services|chat apps;messaging apps|Signal;Discord;Telegram;Messenger;WhatsApp
a|rail|Freight;Track;Pass;Gun;Fence
W|Foods that are verbs|food verbs;food names as verbs|Jam;Butter;Pepper;Cream;Toast
b|side|Country;Broad;Blind;In;Court
t|lenses|Eyeglasses;Microscope;Telescope;Camera;Binoculars
S|Streaming services|video streaming platforms;TV streaming services|Peacock;Paramount+;Hulu;Disney+;Netflix
b|load|Truck;Pay;Down;Off;Free
W|Number prefixes|numerical prefixes;words with number prefixes|Bilateral;Trilogy;Pentagon;Octopus;Decathlon
a|log|On;Off;In;Jam;Cabin
v|charged/charge|Account;Battery;Particle;Suspect;Card
S|Video game consoles|gaming consoles;game systems|Switch;Dreamcast;Saturn;PlayStation;Xbox
b|pin|Safety;Rolling;Bowling;Drawing;Bobby
W|Animal adjectives|adjectives from animals;animal personality words|Catty;Fishy;Crabby;Bullish;Sheepish
b|trip|Business;Ego;Guilt;Round;Field
v|polished/polish|Speech;Performance;Silver;Furniture;Boots
S|Arcade games|classic arcade games;arcade video games|Defender;Asteroids;Tempest;Space Invaders;Pac-Man
b|buster|Myth;Crime;Gang;Block;Ghost
W|Color idioms|colour idioms;color expressions|Red tape;White lie;Blue moon;Pink slip;Green thumb
b|master|Task;Quiz;Web;School;Chess
v|packed/pack|Lunch;Dirt;Stadium;Parachute;Van
S|Video game characters|gaming characters;computer game characters|Kirby;Link;Sonic;Lara Croft;Mario
b|keeper|Goal;Peace;Gate;Zoo;Shop
W|Animal idioms|animal expressions;animal sayings|Lone wolf;Eager beaver;Paper tiger;Cash cow;Top dog
a|road|Trip;Show;Hog;Bed;Block
v|cast/cast|Vote;Doubt;Shadow;Actor;Line
S|Superheroes|comic book heroes;super heroes|Hawkeye;Vision;Rogue;Batman;Superman
b|course|Race;Of;Main;Training;Obstacle
W|Food idioms|food expressions;food sayings|Big cheese;Tough cookie;Sour grapes;Couch potato;Small potatoes
v|trimmed/trim|Budget;Toenail;Hedge;Beard;Mustache
a|be|Come;Low;Fore;Hind;Long
S|Disney princesses|Disney heroines;Disney royalty|Jasmine;Belle;Aurora;Ariel;Cinderella
W|Rhyming phrases|rhyming pairs;rhyming expressions|Hocus-pocus;Helter-skelter;Super-duper;Razzle-dazzle;Itsy-bitsy
a|blow|Torch;Horn;Pipe;Dry;Hole
v|pressed/press|Claim;Shirt;Olive;Grape;Button
a|bare|Skin;Chest;Bones;Knuckle;Minimum
S|Muppet characters|Muppets;the Muppets|Animal;Beaker;Scooter;Gonzo;Kermit
W|Compound animals|compound animal names;animal name compounds|Catfish;Bullfrog;Dogfish;Seahorse;Butterfly
b|wear|Formal;Outer;Evening;Sports;Swim
v|filed/file|Complaint;Taxes;Document;Metal;Fingernail
b|craft|State;Stage;Air;Hover;Witch
S|Sesame Street characters|Sesame Street cast;Sesame Street Muppets|Oscar;Grover;Rosita;Elmo;Big Bird
W|Compound foods|compound food names;food name compounds|Pancake;Cupcake;Meatball;Hotdog;Popcorn
a|soft|Serve;Drink;Top;Landing;Cover
v|launched/launch|Campaign;Product;Website;Satellite;Rocket
a|hard|Rock;Copy;Boiled;Cash;Hat
S|Peanuts characters|Peanuts comic characters;Charlie Brown characters|Violet;Peppermint Patty;Linus;Lucy;Snoopy
W|Body parts as verbs|anatomical verbs;body part verbs|Knee;Shoulder;Stomach;Head;Eye
b|step|Quick;Two;Stair;Dub;Lock
v|planted/plant|Idea;Evidence;Spy;Feet;Seedling
b|list|Wish;Guest;Shopping;Short;Set
S|Harry Potter characters|Harry Potter cast;characters from Harry Potter|Sirius;Luna;Severus;Hermione;Dumbledore
W|Capitalization changes meaning|capitonyms;words with capitalized meanings|Polish;August;Turkey;China;March
a|ever|More;After;Lasting;Present;Green
v|tied/tie|Score;Lure;Ribbon;Apron;Shoelace
b|berry|Black;Blue;Straw;Rasp;Goose
S|Tolkien characters|LOTR characters;Lord of the Rings|Sam;Merry;Pippin;Gandalf;Frodo
W|Oxymorons|contradictory phrases;self contradictory expressions|Original copy;Open secret;Deafening silence;Living dead;Jumbo shrimp`;

let bank: PinpointPuzzle[] | undefined;
export function pinpointPuzzles(): PinpointPuzzle[] {
  return (bank ??= PINPOINT_DATA.split('\n').map((line, index) => {
    const [tag, name, field, last = ''] = line.split('|');
    const compound = tag === 'b' || tag === 'a';
    const attribute = tag === 't' || tag === 'v';
    const direction = tag === 'b' ? 'before' : 'after';
    const [participle, verb] = name.split('/');
    const category = compound
      ? `Words ${direction} ${name}`
      : tag === 't'
        ? `Things with ${name}`
        : tag === 'v'
          ? `Things that can be ${participle}`
          : name;
    const accepted = compound
      ? [
          name,
          `${name} words`,
          `${name} compounds`,
          `things ${direction} ${name}`,
          `words ${tag === 'b' ? 'preceding' : 'following'} ${name}`,
          `compound words ${tag === 'b' ? 'with' : 'starting with'} ${name}`,
          `words that come ${direction} ${name}`,
          `words ${tag === 'b' ? 'ending in' : 'starting with'} ${name}`,
          `compound words with ${name}`,
          ...(name === 'ball' ? ['ball ending compounds'] : []),
        ]
      : tag === 't'
        ? [name, `things that have ${name}`, `objects with ${name}`]
        : tag === 'v'
          ? [participle, verb, `things you can ${verb}`, `can be ${participle}`]
          : field.split(';');
    return {
      kind: compound ? 'C' : attribute ? 'T' : (tag as PinpointPuzzle['kind']),
      category,
      accepted: [...new Set([category, ...accepted])],
      clues: (compound || attribute ? field : last).split(';'),
      reject: [],
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
