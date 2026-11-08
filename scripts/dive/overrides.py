"""Hand-curated prompts, Pearl picks, Too Clever picks, Surface anchors and aliases.

Sources are real lists; reviewed additions remain stable across regenerations.
The source list is not claimed to exhaust every valid answer. Wikidata-sourced prompts and
extensions are declared in `wikidata_prompts.py` and merged here.
"""

from wikidata_prompts import SPECS as WIKIDATA_SPECS


def p(id, noun, source, gem, clever, surface, aliases=None):
    return dict(id=id, text=f"Name {noun}.", source=source, gem=gem,
                too_clever=[x for x in clever.split(';') if x], surface=surface.split(';'), aliases=aliases or {})


PROMPTS = [
    p('animals', 'an animal', 'animals/common#animals+animals/collateral_adjectives#animals.name', 'axolotl', 'platypus;aardvark', 'dog;cat;horse;lion;elephant', {'dog': ['canine'], 'cat': ['feline']}),
    p('dogs', 'a dog breed', 'animals/dogs#dogs', 'Otterhound', 'Xoloitzcuintli;Basenji', 'Labrador Retriever;Golden Retriever;German Shepherd;Poodle;Beagle', {'Labrador Retriever': ['labrador', 'lab'], 'German Shepherd': ['Alsatian']}),
    p('cats', 'a cat breed', 'animals/cats#cats', 'LaPerm', 'Sphynx;Munchkin', 'Persian;Siamese;Maine Coon;Ragdoll;Bengal', {'Sphynx': ['sphinx cat']}),
    p('dinosaurs', 'a dinosaur', 'animals/dinosaurs#dinosaurs', 'Parasaurolophus', 'Archaeopteryx;Therizinosaurus', 'Tyrannosaurus;Triceratops;Stegosaurus;Velociraptor;Brachiosaurus', {'Tyrannosaurus': ['T Rex', 'Tyrannosaurus rex'], 'Brontosaurus': ['bronto']}),
    p('horses', 'a horse breed', 'animals/horses#horses', 'Marwari', 'Akhal-Teke', 'Arabian;Thoroughbred;Quarter Horse;Clydesdale;Mustang', {'Quarter Horse': ['American Quarter Horse']}),
    p('first-names', 'a first name', 'humans/firstNames#firstNames', 'Juniper', 'Zephyr', 'James;Mary;John;Elizabeth;Sarah'),
    p('rabbits', 'a rabbit breed', 'animals/rabbits#rabbits', 'Silver Fox', 'Lionhead', 'Holland Lop;Netherland Dwarf;Flemish Giant;Rex;Angora'),
    p('birds', 'a bird', 'animals/birds_north_america#birds.members', 'Hoopoe', 'Shoebill;Kakapo', 'Robin;Eagle;Sparrow;Pigeon;Owl', {'Pigeon': ['rock dove']}),
    p('seafood', 'a type of seafood', 'foods/fish#fish+foods/shellfish#fish', 'Geoduck', 'Fugu', 'Salmon;Tuna;Shrimp;Lobster;Crab', {'Shrimp': ['prawn']}),
    p('fruits', 'a fruit', 'foods/fruits#fruits', 'Rambutan', 'Durian;Dragonfruit', 'Apple;Banana;Orange;Grape;Strawberry', {'Dragonfruit': ['dragon fruit', 'pitaya'], 'Star fruit': ['carambola']}),
    p('vegetables', 'a vegetable', 'foods/vegetables#vegetables', 'Romanesco', 'Kohlrabi;Fiddlehead', 'Carrot;Potato;Broccoli;Onion;Cabbage', {'Aubergine': ['eggplant'], 'Courgette': ['zucchini']}),
    p('spices', 'an herb, spice or seasoning', 'foods/herbs_n_spices#herbs+foods/herbs_n_spices#spices+foods/herbs_n_spices#mixtures', 'Grains of paradise', 'Saffron;Asafoetida', 'Basil;Pepper;Salt;Cinnamon;Oregano', {'Cilantro': ['coriander leaf']}),
    p('cheeses', 'a cheese or fermented dairy product', 'foods/curds#curds', 'Casu marzu', 'Stinking Bishop', 'Cheddar;Mozzarella;Brie;Parmesan;Gouda', {'Mozzarella': ['mozz'], 'Parmesan': ['parmigiano reggiano']}),
    p('sandwiches', 'a type of sandwich', 'foods/sandwiches#sandwiches.name', 'Francesinha', 'Banh mi', 'BLT;Grilled cheese;Club sandwich;Ham sandwich;Peanut butter and jelly', {'Peanut butter and jelly': ['PB and J', 'PBJ'], 'Banh mi': ['banhmi']}),
    p('sausages', 'a type of sausage', 'foods/sausages#sausages', 'Alheira', 'Haggis', 'Bratwurst;Chorizo;Hot dog;Salami;Italian sausage', {'Bratwurst': ['brat']}),
    p('apples', 'an apple variety', 'foods/apple_cultivars#cultivars', 'Pink Pearl', 'Cox Orange Pippin', 'Granny Smith;Gala;Fuji;Honeycrisp;Red Delicious', {'Honeycrisp': ['honey crisp']}),
    p('tea', 'a tea variety or blend', 'foods/tea#teas', 'Bai Mudan', 'Lapsang Souchong', 'Green;Black;Earl Grey;Chamomile;Peppermint', {'Green': ['green tea'], 'Black': ['black tea'], 'Earl Grey': ['earl gray']}),
    p('condiments', 'a condiment', 'foods/condiments#condiments', 'Ajvar', 'Marmite;Vegemite', 'Ketchup;Mustard;Mayonnaise;Soy sauce;Hot sauce', {'Mayonnaise': ['mayo'], 'Ketchup': ['catsup']}),
    p('beer', 'a beer style', 'foods/beer_styles#beer_styles', 'Gose', 'Rauchbier', 'Lager;Stout;Pilsner;Porter;India pale ale', {'India pale ale': ['IPA']}),
    p('cocktails', 'a cocktail', 'foods/iba_cocktails#cocktails', 'Paper Plane', 'Corpse Reviver', 'Martini;Margarita;Mojito;Old Fashioned;Manhattan'),
    p('flowers', 'a flowering plant', 'plants/flowers#flowers', 'Love-in-a-mist', 'Corpse flower', 'Rose;Tulip;Daisy;Sunflower;Lily', {'Love-in-a-mist': ['nigella']}),
    p('plants', 'a plant', 'plants/plants#plants.name', 'Welwitschia', 'Venus flytrap', 'Oak;Rose;Grass;Pine;Sunflower', {'Venus flytrap': ['venus fly trap']}),
    p('toxic-plants', 'a poisonous plant', 'plants/toxic_plants#plants', 'Doll eyes', 'Gympie-gympie', 'Poison ivy;Poison oak;Hemlock;Oleander;Foxglove', {'Doll eyes': ['dolls eyes', 'white baneberry']}),
    p('gemstones', 'a gemstone', 'materials/gemstones#gemstones', 'Labradorite', 'Painite;Tanzanite', 'Diamond;Ruby;Emerald;Sapphire;Amethyst'),
    p('fabrics', 'a fabric', 'materials/fabrics#fabrics', 'Seersucker', 'Qiviut', 'Cotton;Silk;Wool;Linen;Denim'),
    p('stones', 'a decorative stone', 'materials/decorative-stones#decorative stones', 'Larvikite', 'Obsidian', 'Marble;Granite;Slate;Limestone;Sandstone'),
    p('metals', 'a metal or alloy', 'materials/metals#metals', 'Galinstan', 'Nitinol', 'Gold;Silver;Iron;Copper;Steel', {'Aluminium': ['aluminum']}),
    p('clothing', 'an item of clothing', 'objects/clothing#clothes', 'Peacoat', 'Dirndl', 'Shirt;Pants;Dress;Socks;Hat', {'Pants': ['trousers']}),
    p('rooms', 'a type of room', 'architecture/rooms#rooms', 'Orangery', 'Oubliette', 'Kitchen;Bedroom;Bathroom;Living room;Dining room'),
    p('objects', 'an everyday object', 'objects/objects#objects', 'Thimble', 'Spork', 'Chair;Table;Phone;Pen;Book'),
    p('appliances', 'a household appliance', 'technology/appliances#appliances', 'Yogurt maker', 'Sous vide cooker', 'Refrigerator;Oven;Microwave;Toaster;Dishwasher', {'Refrigerator': ['fridge']}),
    p('sports', 'a sport', 'sports/sports#sports', 'Sepak takraw', 'Chess boxing;Quidditch', 'Soccer;Basketball;Tennis;Baseball;Swimming', {'Soccer': ['association football']}),
    p('board-games', 'a board game', 'games/board_games#games', 'Azul', 'The Campaign for North Africa', 'Chess;Monopoly;Scrabble;Clue;Risk', {'Clue': ['Cluedo'], 'Catan': ['Settlers of Catan']}),
    p('pokemon', 'a Pokémon', 'games/pokemon#pokemon.name', 'Shuckle', 'MissingNo;Ditto', 'Pikachu;Charizard;Bulbasaur;Squirtle;Eevee'),
    p('wrestling', 'a wrestling move', 'games/wrestling_moves#moves', 'La magistral', 'Canadian Destroyer', 'Suplex;Headlock;Body slam;Piledriver;Dropkick'),
    p('monsters', 'a mythical creature', 'mythology/monsters#names+mythology/greek_monsters#greek_monsters', 'Peryton', 'Tarrasque', 'Dragon;Unicorn;Griffin;Mermaid;Werewolf', {'Griffin': ['gryphon']}),
    p('greek-gods', 'a Greek god or Titan', 'mythology/greek_myths_master#greek_gods+mythology/greek_myths_master#greek_titans', 'Hestia', 'Priapus', 'Zeus;Poseidon;Hades;Athena;Apollo'),
    p('colors', 'a color', 'colors/wikipedia#@.name', 'Gamboge', 'Chartreuse;Vantablack', 'Red;Blue;Green;Yellow;Purple', {'Gray': ['grey']}),
    p('crayons', 'a Crayola crayon color', 'colors/crayola#colors.color', 'Macaroni and Cheese', 'Razzmatazz', 'Red;Blue;Green;Yellow;Black'),
    p('countries', 'a country', 'geography/countries#countries', 'Bhutan', 'Tuvalu;Vatican City', 'France;United States;China;India;Canada', {'United States': ['USA', 'US', 'United States of America'], 'United Kingdom': ['UK', 'Britain'], 'Czech Republic': ['Czechia']}),
    p('capitals', 'a national capital', 'geography/countries_with_capitals#countries.capital', 'Thimphu', 'Ngerulmud', 'Paris;London;Tokyo;Rome;Beijing', {'Washington DC': ['Washington D.C.', 'Washington'], 'Beijing': ['Peking']}),
    p('nationalities', 'a nationality', 'geography/nationalities#nationalities', 'Seychellois', 'Monegasque', 'American;French;Chinese;British;Canadian'),
    p('rivers', 'a river', 'geography/rivers#rivers.name', 'Okavango', 'Onyx', 'Nile;Amazon;Mississippi;Thames;Ganges', {'Yangtze': ['Yangtse']}),
    p('seas', 'a sea', 'geography/oceans#seas.name', 'Sargasso Sea', 'Sea of Tranquility', 'Mediterranean Sea;Red Sea;Black Sea;Caribbean Sea;Baltic Sea', {'Mediterranean Sea': ['Mediterranean']}),
    p('landforms', 'a geographical feature', 'geography/geographic_features#entries', 'Tombolo', 'Oxbow lake', 'Mountain;River;Valley;Island;Lake'),
    p('winds', 'a named wind', 'geography/winds#winds', 'Fremantle Doctor', 'Katabatic wind', 'Trade wind;Westerlies;Mistral;Sirocco;Chinook'),
    p('english-towns', 'a town or city in England', 'geography/english_towns_cities#towns+geography/english_towns_cities#cities', 'Whitby', 'Llanfairpwllgwyngyll', 'London;Manchester;Liverpool;Birmingham;Oxford'),
    p('tube', 'a London Underground station', 'geography/london_underground_stations#stations.name', 'Cockfosters', 'Mornington Crescent', 'Waterloo;Baker Street;Oxford Circus;Victoria;Paddington'),
    p('states', 'a US state or territory', 'states', 'Guam', 'Northern Mariana Islands', 'California;Texas;Florida;New York;Hawaii', {'California': ['CA'], 'New York': ['NY'], 'Texas': ['TX']}),
    p('languages', 'a language', 'languages', 'Rotokas', 'Esperanto;Klingon', 'English;Spanish;French;German;Chinese', {'Chinese': ['Mandarin', 'Mandarin Chinese'], 'Spanish': ['Castilian']}),
    p('scientists', 'a scientist', 'humans/scientists#scientists', 'Chien-Shiung Wu', 'Richard Feynman', 'Albert Einstein;Isaac Newton;Marie Curie;Charles Darwin;Galileo Galilei', {'Albert Einstein': ['Einstein'], 'Isaac Newton': ['Newton'], 'Galileo Galilei': ['Galileo']}),
    p('authors', 'an author', 'books/bestsellers#books.author', 'Ursula K. Le Guin', 'Thomas Pynchon', 'William Shakespeare;J. K. Rowling;Stephen King;Jane Austen;Charles Dickens', {'William Shakespeare': ['Shakespeare'], 'J. K. Rowling': ['JK Rowling', 'Rowling'], 'Stephen King': ['King'], 'Jane Austen': ['Austen'], 'Charles Dickens': ['Dickens'], 'Ursula K. Le Guin': ['Le Guin'], 'Thomas Pynchon': ['Pynchon']}),
    p('books', 'a book', 'books/bestsellers#books.title', 'The Shadow of the Wind', 'House of Leaves', 'The Hobbit;Harry Potter and the Philosophers Stone;Pride and Prejudice;1984;The Lord of the Rings', {'Harry Potter and the Philosophers Stone': ['Harry Potter and the Sorcerers Stone']}),
    p('british-actors', 'a British actor', 'humans/britishActors#britishActors', 'Olivia Colman', 'Benedict Cumberbatch', 'Daniel Radcliffe;Emma Watson;Judi Dench;Maggie Smith;Michael Caine'),
    p('jobs', 'an occupation', 'humans/occupations#occupations', 'Foley artist', 'Actuary', 'Teacher;Doctor;Engineer;Nurse;Lawyer'),
    p('subjects', 'an academic subject', 'books/academic_subjects#subjects', 'Dendrochronology', 'Paleography', 'Mathematics;English;History;Biology;Chemistry', {'Mathematics': ['math']}),
    p('art', 'an art movement or style', 'art/isms#isms', 'Orphism', 'Dadaism', 'Impressionism;Cubism;Surrealism;Realism;Expressionism', {'Dadaism': ['dada']}),
    p('music-genres', 'a music genre', 'music/genres#genres', 'Zydeco', 'Vaporwave', 'Rock;Pop;Jazz;Classical;Hip hop', {'Hip hop': ['hiphop']}),
    p('instruments', 'a musical instrument', 'music/instruments#instruments', 'Nyckelharpa', 'Theremin', 'Piano;Guitar;Violin;Drums;Flute'),
    p('rock-hall', 'a Rock and Roll Hall of Fame artist', 'music/rock_hall_of_fame#artists.name', 'Sister Rosetta Tharpe', 'Frank Zappa', 'The Beatles;Elvis Presley;The Rolling Stones;Queen;David Bowie', {'Elvis Presley': ['Elvis']}),
    p('guitars', 'a guitar maker', 'music/a_list_of_guitar_manufacturers#guitar manufacturing companies.name', 'Duesenberg', 'Strandberg', 'Fender;Gibson;Yamaha;Ibanez;Martin'),
    p('movies', 'a movie', 'movies:all+film-tv/popular-movies#popular-movies', 'The Iron Giant', 'Primer', 'Titanic;Avatar;Star Wars;The Godfather;Jurassic Park', {'Star Wars': ['A New Hope', 'Star Wars A New Hope']}),
    p('tv', 'a TV show', 'film-tv/tv_shows#tv_shows', 'Detectorists', 'Twin Peaks', 'Friends;The Simpsons;Breaking Bad;Game of Thrones;The Office'),
    p('elements', 'a chemical element', 'science/elements#elements.name', 'Bismuth', 'Unobtainium', 'Oxygen;Hydrogen;Carbon;Gold;Iron', {'Aluminium': ['aluminum'], 'Sulfur': ['sulphur']}),
    p('weather', 'a weather condition', 'science/weather_conditions#conditions', 'Diamond dust', 'Thundersnow', 'Rain;Snow;Fog;Hail;Sleet'),
    p('meteorology', 'a meteorological term', 'science/meteorology#meteorology', 'Virga', 'Petrichor', 'Cloud;Rain;Snow;Wind;Storm'),
    p('constellations', 'a constellation', 'constellations', 'Delphinus', 'Ophiuchus', 'Orion;Ursa Major;Leo;Scorpius;Cassiopeia', {'Ursa Major': ['great bear'], 'Ursa Minor': ['little bear'], 'Ophiuchus': ['Ophiucus'], 'Chamaeleon': ['Chamaleon']}),
    p('cars', 'a car brand', 'corporations/cars#cars', 'Spyker', 'Koenigsegg', 'Ford;Toyota;Honda;BMW;Mercedes-Benz', {'Mercedes-Benz': ['Mercedes']}),
    p('companies', 'a company', 'corporations/fortune500#companies', 'Weyerhaeuser', 'Berkshire Hathaway', 'Apple;Amazon;Microsoft;Walmart;Google'),
    p('newspapers', 'a newspaper', 'corporations/newspapers#newspapers', 'The Asahi Shimbun', 'The Onion', 'The New York Times;The Guardian;The Times;The Washington Post;USA Today', {'The New York Times': ['NYT']}),
    p('industries', 'an industry', 'corporations/industries#industries', 'Silviculture', 'Asteroid mining', 'Technology;Agriculture;Manufacturing;Healthcare;Construction'),
    p('charities', 'a charity', 'corporations/charities#charities', 'Room to Read', 'Heifer International', 'Red Cross;UNICEF;Oxfam;Doctors Without Borders;Save the Children', {'Doctors Without Borders': ['MSF', 'Medecins Sans Frontieres']}),
    p('uk-parties', 'a British political party, past or present', 'governments/uk_political_parties#parties', 'Yorkshire Party', 'Official Monster Raving Loony Party', 'Conservative Party;Labour Party;Liberal Democrats;Green Party;Scottish National Party', {'Conservative Party': ['Conservatives', 'Tories'], 'Labour Party': ['Labour'], 'Scottish National Party': ['SNP']}),
    p('agencies', 'a US federal agency', 'governments/us_federal_agencies#agencies', 'Bureau of Engraving and Printing', 'Bureau of Alcohol Tobacco and Firearms', 'NASA;FBI;CIA;EPA;Department of Education', {'NASA': ['National Aeronautics and Space Administration'], 'FBI': ['Federal Bureau of Investigation'], 'CIA': ['Central Intelligence Agency'], 'EPA': ['Environmental Protection Agency']}),
    p('us-capitals', 'a US state capital', 'geography/us_state_capitals#capitals.capital', 'Montpelier', 'Pierre', 'Austin;Sacramento;Boston;Denver;Phoenix'),
    p('knots', 'a type of knot', 'technology/knots#knots', 'Zeppelin bend', 'Monkey fist', 'Bowline;Reef knot;Clove hitch;Slip knot;Figure eight', {'Reef knot': ['square knot'], 'Figure eight': ['figure of eight knot']}),
    p('scents', 'a scent', 'materials/scents#scent', 'Vetiver', 'Petrichor', 'Rose;Vanilla;Lavender;Lemon;Cinnamon'),
    p('fictional-materials', 'a fictional material', 'materials/fictional-materials#fictional materials', 'Octiron', 'Unobtainium', 'Kryptonite;Vibranium;Adamantium;Mithril;Dilithium', {'Mithril': ['mithral']}),
    p('tolkien', 'a Tolkien character', 'humans/tolkienCharacterNames#names', 'Goldberry', 'Tom Bombadil', 'Frodo Baggins;Gandalf;Bilbo Baggins;Aragorn;Legolas', {'Frodo Baggins': ['Frodo'], 'Bilbo Baggins': ['Bilbo']}),
    p('comedy-movies', 'a comedy movie', 'movies:Comedy', 'Local Hero', 'The Room', 'Home Alone;Superbad;Anchorman;Mean Girls;Dumb and Dumber'),
    p('horror-movies', 'a horror movie', 'movies:Horror', 'Let the Right One In', 'The Wicker Man', 'The Exorcist;Halloween;Scream;The Shining;Alien'),
    p('action-movies', 'an action movie', 'movies:Action', 'The Raid', 'Hard Boiled', 'Die Hard;The Dark Knight;Terminator 2;Speed;Top Gun'),
    p('drama-movies', 'a drama movie', 'movies:Drama', 'The Station Agent', 'Synecdoche New York', 'The Shawshank Redemption;Forrest Gump;Titanic;The Godfather;Fight Club'),
    p('thriller-movies', 'a thriller movie', 'movies:Thriller/Suspense', 'The Conversation', 'Memento', 'Seven;The Silence of the Lambs;Psycho;Gone Girl;Zodiac', {'Seven': ['Se7en']}),
]

CITY_PICKS = [
    ('US', 'the United States', 'Duluth', 'Intercourse', 'New York;Los Angeles;Chicago;Houston;Miami'),
    ('GB', 'the United Kingdom', 'Stirling', 'Llanfairpwllgwyngyll', 'London;Manchester;Birmingham;Liverpool;Edinburgh'),
    ('CA', 'Canada', 'Whitehorse', 'Moose Jaw', 'Toronto;Vancouver;Montreal;Ottawa;Calgary'),
    ('AU', 'Australia', 'Ballarat', 'Wagga Wagga', 'Sydney;Melbourne;Brisbane;Perth;Adelaide'),
    ('NZ', 'New Zealand', 'Rotorua', 'Whanganui', 'Auckland;Wellington;Christchurch;Hamilton;Dunedin'),
    ('JP', 'Japan', 'Kanazawa', 'Nara', 'Tokyo;Osaka;Kyoto;Yokohama;Hiroshima'),
    ('CN', 'China', 'Dali', 'Lhasa', 'Beijing;Shanghai;Hong Kong;Guangzhou;Shenzhen'),
    ('IN', 'India', 'Mysore', 'Varanasi', 'Mumbai;Delhi;Bangalore;Kolkata;Chennai'),
    ('BR', 'Brazil', 'Olinda', 'Manaus', 'Rio de Janeiro;Sao Paulo;Brasilia;Salvador;Recife'),
    ('MX', 'Mexico', 'Guanajuato', 'Chihuahua', 'Mexico City;Guadalajara;Monterrey;Cancun;Tijuana'),
    ('FR', 'France', 'Annecy', 'Carcassonne', 'Paris;Lyon;Marseille;Nice;Bordeaux'),
    ('IT', 'Italy', 'Lucca', 'San Gimignano', 'Rome;Milan;Venice;Florence;Naples'),
    ('ES', 'Spain', 'Ronda', 'Cuenca', 'Madrid;Barcelona;Seville;Valencia;Granada'),
    ('DE', 'Germany', 'Bamberg', 'Bielefeld', 'Berlin;Munich;Hamburg;Frankfurt;Cologne'),
    ('RU', 'Russia', 'Suzdal', 'Norilsk', 'Moscow;Saint Petersburg;Novosibirsk;Kazan;Sochi'),
    ('AR', 'Argentina', 'Ushuaia', 'San Carlos de Bariloche', 'Buenos Aires;Cordoba;Rosario;Mendoza;La Plata'),
    ('CO', 'Colombia', 'Popayan', 'Leticia', 'Bogota;Medellin;Cali;Cartagena;Barranquilla'),
    ('CL', 'Chile', 'Punta Arenas', 'Valparaiso', 'Santiago;Concepcion;Antofagasta;Temuco;Vina del Mar'),
    ('PE', 'Peru', 'Iquitos', 'Puno', 'Lima;Cusco;Arequipa;Trujillo;Chiclayo'),
    ('ZA', 'South Africa', 'Knysna', 'Bloemfontein', 'Cape Town;Johannesburg;Durban;Pretoria;Port Elizabeth'),
    ('EG', 'Egypt', 'Aswan', 'Luxor', 'Cairo;Alexandria;Giza;Port Said;Suez'),
    ('NG', 'Nigeria', 'Calabar', 'Sokoto', 'Lagos;Abuja;Kano;Ibadan;Port Harcourt'),
    ('KE', 'Kenya', 'Lamu', 'Naivasha', 'Nairobi;Mombasa;Kisumu;Nakuru;Eldoret'),
    ('GR', 'Greece', 'Nafplio', 'Sparta', 'Athens;Thessaloniki;Patras;Heraklion;Rhodes'),
    ('PT', 'Portugal', 'Tavira', 'Fatima', 'Lisbon;Porto;Braga;Coimbra;Faro'),
    ('NL', 'the Netherlands', 'Delft', 'Gouda', 'Amsterdam;Rotterdam;The Hague;Utrecht;Eindhoven'),
    ('BE', 'Belgium', 'Dinant', 'Ypres', 'Brussels;Antwerp;Bruges;Ghent;Liege'),
    ('PL', 'Poland', 'Torun', 'Zakopane', 'Warsaw;Krakow;Gdansk;Wroclaw;Poznan'),
    ('SE', 'Sweden', 'Visby', 'Kiruna', 'Stockholm;Gothenburg;Malmo;Uppsala;Lund'),
    ('FI', 'Finland', 'Porvoo', 'Rovaniemi', 'Helsinki;Tampere;Turku;Espoo;Oulu'),
    ('TR', 'Turkey', 'Safranbolu', 'Batman', 'Istanbul;Ankara;Izmir;Antalya;Bursa'),
    ('TH', 'Thailand', 'Lampang', 'Pai', 'Bangkok;Chiang Mai;Phuket;Pattaya;Chiang Rai'),
    ('ID', 'Indonesia', 'Yogyakarta', 'Surakarta', 'Jakarta;Surabaya;Bandung;Medan;Denpasar'),
    ('PH', 'the Philippines', 'Vigan', 'Baguio', 'Manila;Quezon City;Cebu City;Davao;Makati'),
    ('VN', 'Vietnam', 'Hoi An', 'Hue', 'Hanoi;Ho Chi Minh City;Da Nang;Hai Phong;Can Tho'),
    ('KR', 'South Korea', 'Gyeongju', 'Jeonju', 'Seoul;Busan;Incheon;Daegu;Daejeon'),
    ('IE', 'Ireland', 'Dingle', '', 'Dublin;Cork;Galway;Limerick;Waterford'),
    ('CH', 'Switzerland', 'Zermatt', '', 'Zurich;Geneva;Bern;Basel;Lausanne'),
    ('AT', 'Austria', 'Hallstatt', '', 'Vienna;Salzburg;Innsbruck;Graz;Linz'),
    ('NO', 'Norway', 'Ålesund', '', 'Oslo;Bergen;Trondheim;Stavanger;Tromsø'),
    ('CZ', 'the Czech Republic', 'Český Krumlov', '', 'Prague;Brno;Ostrava;Plzeň;Karlovy Vary'),
    ('HU', 'Hungary', 'Eger', '', 'Budapest;Debrecen;Szeged;Pécs;Győr'),
    ('HR', 'Croatia', 'Rovinj', '', 'Zagreb;Split;Dubrovnik;Rijeka;Zadar'),
    ('MA', 'Morocco', 'Chefchaouen', '', 'Marrakesh;Casablanca;Rabat;Fez;Tangier'),
    ('MY', 'Malaysia', 'Ipoh', '', 'Kuala Lumpur;George Town;Malacca;Johor Bahru;Kota Kinabalu'),
    ('PK', 'Pakistan', 'Gilgit', '', 'Karachi;Lahore;Islamabad;Rawalpindi;Peshawar'),
    ('RO', 'Romania', 'Sighișoara', '', 'Bucharest;Cluj-Napoca;Timișoara;Iași;Brașov'),
]
CITY_ALIASES = {
    'US': {'New York': ['New York City', 'NYC'], 'Los Angeles': ['LA']},
    'CN': {'Beijing': ['Peking']},
    'IN': {'Mumbai': ['Bombay'], 'Bangalore': ['Bengaluru'], 'Kolkata': ['Calcutta'], 'Chennai': ['Madras']},
    'IT': {'Rome': ['Roma'], 'Florence': ['Firenze']},
    'DE': {'Munich': ['Munchen'], 'Cologne': ['Koln']},
    'NL': {'The Hague': ['Den Haag']},
    'SE': {'Gothenburg': ['Goteborg']},
    'VN': {'Ho Chi Minh City': ['Saigon']},
    'ZA': {'Port Elizabeth': ['Gqeberha']},
    'PH': {'Makati': ['Makati City'], 'Cebu City': ['Cebu'], 'Davao': ['Davao City'], 'Bacolod City': ['Bacolod']},
    'CZ': {'Prague': ['Praha']},
    'AT': {'Vienna': ['Wien']},
    'CH': {'Geneva': ['Geneve', 'Genf']},
    'MA': {'Marrakesh': ['Marrakech'], 'Fez': ['Fes']},
    'MY': {'Malacca': ['Melaka']},
}
PROMPTS += [p(f'cities-{code.lower()}', f'a city or town in {country}', f'cities:{code}',
              gem, clever, surface, CITY_ALIASES.get(code))
            for code, country, gem, clever, surface in CITY_PICKS]

# Invalid-but-famous suggestions are not rewards: these must miss, not become Too Clever.
EXCLUDE = {
    'animals': ['aadvark'],
    'seafood': ['cooking fish'],
    'beer': ['out of category'],
    'flowers': ['roses'],
    'sports': ['Club', 'Team play', 'Ball', 'Bat-and-ball games', 'Ball-over-net games', 'Board sports'],
    'pokemon': ['MissingNo'],
    'seas': ['Sea of Tranquility'],
    'english-towns': ['Llanfairpwllgwyngyll'],
    'elements': ['Unobtainium'],
    'industries': ['Asteroid mining'],
    'objects': '''acorn;apple;bananas;beef;bread;broccoli;carrots;cat;chicken;chocolate;cow;crow;cucumber;dog;dolphin;dove;egg;fish;flowers;food;giraffe;hamster;house;ice cube;lemon;lime;lion;milk;money;orange;panda;puddle;rabbit;rat;rhino;shark;sheep;sidewalk;squirrel;tomato;tree;tiger;trucks;turtle;water;whale;zebra'''.split(';'),
}
REPLACEMENTS = {
    'pokemon': ['Wobbuffet'], 'seas': ['Dead Sea'], 'english-towns': ['Bognor Regis'],
    'elements': ['Astatine'], 'industries': ['Nanotechnology'],
}
for prompt in PROMPTS:
    if prompt['id'] in EXCLUDE:
        prompt['exclude'] = EXCLUDE[prompt['id']]
        prompt['too_clever'] = [x for x in prompt['too_clever'] if x not in prompt['exclude']]
        prompt['too_clever'] += REPLACEMENTS.get(prompt['id'], [])

# The upstream dinosaur scrape mixes genera with unrelated navigation/taxonomy links.
# Accept only this reviewed genus allowlist, plus the explicit anchors above.
DINOSAURS = '''Tyrannosaurus Triceratops Stegosaurus Velociraptor Brachiosaurus Diplodocus
Allosaurus Apatosaurus Brontosaurus Ankylosaurus Spinosaurus Iguanodon Parasaurolophus
Pachycephalosaurus Compsognathus Deinonychus Oviraptor Gallimimus Protoceratops Carnotaurus
Albertosaurus Tarbosaurus Suchomimus Coelophysis Carcharodontosaurus Giganotosaurus Maiasaura
Edmontosaurus Lambeosaurus Corythosaurus Hadrosaurus Ouranosaurus Saurolophus Shantungosaurus
Tsintaosaurus Shunosaurus Amargasaurus Camarasaurus Mamenchisaurus Argentinosaurus Patagotitan
Dreadnoughtus Saltasaurus Alamosaurus Ampelosaurus Euhelopus Jobaria Rebbachisaurus Nigersaurus
Dicraeosaurus Barosaurus Supersaurus Seismosaurus Silvisaurus Polacanthus Gastonia Euoplocephalus
Sauropelta Nodosaurus Panoplosaurus Minmi Shamosaurus Talarurus Saichania Zuniceratops
Pentaceratops Styracosaurus Centrosaurus Chasmosaurus Torosaurus Pachyrhinosaurus Psittacosaurus
Leptoceratops Montanoceratops Avaceratops Arrhinoceratops Einiosaurus Anchiceratops Achelousaurus
Kosmoceratops Utahceratops Nasutoceratops Diabloceratops Hypsilophodon Thescelosaurus Dryosaurus
Tenontosaurus Camptosaurus Muttaburrasaurus Leaellynasaura Othnielia Agilisaurus Lesothosaurus
Heterodontosaurus Scelidosaurus Scutellosaurus Kentrosaurus Huayangosaurus Tuojiangosaurus
Chungkingosaurus Miragaia Wuerhosaurus Dacentrurus Gigantspinosaurus Monolophosaurus Dilophosaurus
Ceratosaurus Megalosaurus Torvosaurus Acrocanthosaurus Neovenator Eustreptospondylus Sinraptor
Yangchuanosaurus Afrovenator Baryonyx Irritator Austroraptor Utahraptor Dromaeosaurus
Saurornitholestes Troodon Stenonychosaurus Zanabazar Ornithomimus Struthiomimus Deinocheirus
Therizinosaurus Segnosaurus Nothronychus Beipiaosaurus Falcarius Alxasaurus Citipati Conchoraptor
Khaan Ingenia Archaeopteryx Microraptor Anchiornis Sinosauropteryx Caudipteryx Sinornithosaurus
Yutyrannus Dilong Guanlong Eotyrannus Proceratosaurus Alioramus Daspletosaurus Alectrosaurus
Sinotyrannus'''.split()
for prompt in PROMPTS:
    if prompt['id'] == 'dinosaurs':
        prompt['allow'] = DINOSAURS

# Contextual titles prevent homographs, brands and multiword components from borrowing
# unrelated popularity. Missing pages remain a conservative secondary-signal fallback.
WIKI = {
    'animals': {'ass': 'Donkey', 'fly': 'Fly', 'bear': 'Bear', 'cat': 'Cat', 'dog': 'Dog'},
    'fruits': {'date': 'Date palm', 'Apple': 'Apple', 'Orange': 'Orange (fruit)',
               'blood orange': 'Blood orange', 'Star fruit': 'Carambola', 'kiwi': 'Kiwifruit',
               'fig': 'Common fig', 'Dragonfruit': 'Pitaya', 'Rambutan': 'Rambutan'},
    'elements': {'Lead': 'Lead', 'Gold': 'Gold', 'Iron': 'Iron', 'Carbon': 'Carbon',
                 'Oxygen': 'Oxygen', 'Hydrogen': 'Hydrogen', 'Bismuth': 'Bismuth'},
    'metals': {'lead': 'Lead', 'Gold': 'Gold', 'Silver': 'Silver', 'Iron': 'Iron', 'Steel': 'Steel'},
    'colors': {'Orange': 'Orange (colour)', 'Pink': 'Pink', 'Gold': 'Gold (color)',
               'White': 'White', 'Black': 'Black', 'Red': 'Red', 'Blue': 'Blue'},
    'plants': {'Box': 'Buxus', 'apple': 'Apple', 'Bay': 'Laurus nobilis'},
    'languages': {'English': 'English language', 'Spanish': 'Spanish language', 'French': 'French language',
                  'Chinese': 'Chinese language', 'German': 'German language', 'Rotokas': 'Rotokas language'},
    'instruments': {'Drums': 'Drum', 'Guitar': 'Guitar', 'Piano': 'Piano', 'Violin': 'Violin', 'Flute': 'Flute'},
    'sports': {'Soccer': 'Association football', 'Basketball': 'Basketball', 'Tennis': 'Tennis', 'Baseball': 'Baseball'},
    'tea': {'Green': 'Green tea', 'Black': 'Black tea', 'Earl Grey': 'Earl Grey tea',
            'Chamomile': 'Chamomile', 'Peppermint': 'Peppermint', 'Bai Mudan': 'Bai Mudan', 'Lapsang Souchong': 'Lapsang souchong'},
    'jobs': {'Doctor': 'Physician', 'Nurse': 'Nursing', 'Teacher': 'Teacher', 'Engineer': 'Engineer', 'Lawyer': 'Lawyer'},
    'companies': {'Apple': 'Apple Inc.', 'Amazon': 'Amazon (company)', 'Google': 'Google',
                  'Microsoft': 'Microsoft', 'Walmart': 'Walmart'},
    'guitars': {'Fender': 'Fender Musical Instruments Corporation', 'Gibson': 'Gibson (guitar company)',
                'Martin': 'C. F. Martin & Company', 'Yamaha': 'Yamaha Corporation', 'Ibanez': 'Ibanez'},
    'countries': {'United States': 'United States', 'China': 'China', 'France': 'France', 'India': 'India', 'Canada': 'Canada'},
    'objects': {'Phone': 'Telephone', 'Table': 'Table (furniture)', 'television': 'Television set',
                'radio': 'Radio receiver', 'light': 'Light fixture', 'monitor': 'Computer monitor',
                'speakers': 'Loudspeaker', 'watch': 'Watch'},
    'rock-hall': {'Chicago': 'Chicago (band)', 'Heart': 'Heart (band)', 'Queen': 'Queen (band)',
                  'Genesis': 'Genesis (band)', 'Rush': 'Rush (band)', 'Yes': 'Yes (band)',
                  'Kiss': 'Kiss (band)', 'Journey': 'Journey (band)', 'Faces': 'Faces (band)'},
    'capitals': {'Luxembourg': 'Luxembourg City', 'Washington DC': 'Washington, D.C.'},
}
for prompt in PROMPTS:
    prompt['wiki'] = WIKI.get(prompt['id'], {})
    if prompt['id'] == 'fruits':
        prompt['forced_tiers'] = {'blood orange': 'school', 'Star fruit': 'school', 'quince': 'school', 'nectarine': 'school'}
    if prompt['id'] == 'seas':
        prompt['forced_tiers'] = {'Central Baltic Sea': 'school'}
    if prompt['id'] == 'objects':
        prompt['aliases'].update({'Phone': ['cell phone', 'cellphone', 'mobile phone'],
            'television': ['tv'], 'couch': ['sofa'], 'paintbrush': ['paint brush'],
            'keychain': ['key chain'], 'watch': ['wristwatch'], 'toothpick': ['tooth pick']})


# Wikidata-sourced prompts (new) and extensions (rows appended to an existing source).
WD_SPECS = {spec['id']: spec for spec in WIKIDATA_SPECS}
by_id = {prompt['id']: prompt for prompt in PROMPTS}
for spec in WIKIDATA_SPECS:
    if spec.get('extend'):
        by_id[spec['id']]['source'] += '+wd:' + spec['id']
    else:
        prompt = {key: spec[key] for key in ['id', 'text', 'source', 'gem', 'too_clever', 'surface', 'aliases', 'common']}
        prompt.update(wiki={}, cap=spec['cap'])
        PROMPTS.append(prompt)
        by_id[spec['id']] = prompt
WD_EXCLUDE = {
    'former-countries': ['Nazi Germany', 'Confederate States of America', 'Islamic State'],
    'boxers': ['Andrew Tate'],
    'cartoon-characters': ['Santa Claus', 'Robin Hood', 'Count Dracula'],
    'anime-characters': ['Wikipe-tan'],
    'soft-drinks': ['yogurt', 'kumis', 'milk', 'water', 'tea', 'coffee', 'beer', 'wine'],
    'game-studios': ['ETH Zurich'],
    'norse-myth': ['Orion', 'Goliath'],
    'units': ['euro', 'United States dollar', 'pi', 'bitcoin', 'Stone Age'],
    'furniture': ['altar', 'sundial', 'coffin', 'saddle'],
    'museums': ['Auschwitz', 'Auschwitz concentration camp', 'Auschwitz-Birkenau State Museum'],
    # Genre/occupation tags Wikidata gets wrong for these prompts.
    'fantasy-films': ['The Terminator', 'Terminator 2: Judgment Day', 'Terminator Genisys'],
    'american-actors': ['Walt Disney'],
}
for id, names in WD_EXCLUDE.items():
    by_id[id]['exclude'] = names

# Reviewed duplicates: one entity under two labels (corporate suffixes, spelling variants).
# Each variant becomes an alias of the kept answer, so typing either still scores once.
DEDUPE = {
    'companies': {"McDonald's": ['McDonald’s Corporation'], 'Intel': ['Intel Corporation'],
                  'Delta Air Lines': ['Delta Air Lines, Inc.'],
                  'American Express': ['American Express Company'],
                  'Western Digital': ['Western Digital Corporation']},
    'retailers': {'Target': ['Target Corporation'], 'REWE': ['REWE Group']},
    'restaurant-chains': {"Domino's Pizza": ["Domino's Pizza Group plc"]},
    'game-studios': {'Atari': ['Atari Corporation']},
    'guitars': {'Alembic': ['Alembic Inc'], 'MotorAve': ['Motor Ave']},
    'clothing': {'Peacoat': ['Pea Coat']},
    'art': {'Neoclassicism': ['Neo-Classicism'], 'Postminimalism': ['Post-Minimalism']},
    'palaces': {'Sanssouci Palace': ['Sans-Souci Palace']},
    'tea': {'Huangshan Maofeng': ['Huang Shan Mao Feng']},
    'uk-parties': {'UK Independence Party (UKIP)': ['UK Independence Party (UK I P)']},
}
for id, merges in DEDUPE.items():
    prompt = by_id[id]
    prompt['aliases'] = {**(prompt.get('aliases') or {})}
    for canonical, variants in merges.items():
        prompt['aliases'][canonical] = [*prompt['aliases'].get(canonical, []), *variants]

# Inherently small categories stay in the manifest and data but leave the daily rotation.
INACTIVE = {'us-capitals', 'states', 'greek-gods', 'constellations', 'elements', 'crayons', 'countries',
            'capitals', 'winds', 'scents', 'fictional-materials', 'stones', 'agencies', 'cats', 'rabbits',
            'spices', 'seas', 'industries', 'charities', 'cities-ke', 'cities-kr'}
for prompt in PROMPTS:
    prompt['active'] = prompt['id'] not in INACTIVE
