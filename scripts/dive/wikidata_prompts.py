"""Reviewed Wikidata-sourced Dive prompts: membership query, Surface anchors, Too Clever
picks, one Pearl, aliases and per-set caps. Snapshots live in `wikidata/<id>.tsv`."""


def occ(*qids):
    """Real humans with any of these occupations (P106)."""
    return '?item wdt:P31 wd:Q5 . ' + ' UNION '.join('{ ?item wdt:P106/wdt:P279* wd:%s }' % q for q in qids) + ' '


def inst(*qids, sub=False):
    """Instances (optionally of subclasses) of any of these classes."""
    path = 'wdt:P31/wdt:P279*' if sub else 'wdt:P31'
    return ' UNION '.join('{ ?item %s wd:%s }' % (path, q) for q in qids) + ' '


def kinds(*qids):
    """Subclasses (types) of these classes, e.g. kinds of tool, not individual tools."""
    return ' UNION '.join('{ ?item wdt:P279+ wd:%s }' % q for q in qids) + ' '


def taxon(root, prune=20, stop=()):
    return ('taxon', root, prune, tuple(stop))


def w(id, noun, query, gem, clever, surface, aliases=None, kind='thing', min=5, cap=450,
      common=False, fictional=False, latin_ok=False, no_digits=False, exclude_types=(), aliases_max=3, desc=None, keep=()):
    return dict(id=id, text=f'Name {noun}.', source=f'wd:{id}', gem=gem,
                too_clever=[x for x in clever.split(';') if x], surface=surface.split(';'),
                aliases=aliases or {}, query=query, kind=kind, min=min, cap=cap,
                fetch=int(cap * 1.1) + 20, common=common, fictional=fictional, latin_ok=latin_ok,
                no_digits=no_digits, exclude_types=set(exclude_types), aliases_max=aliases_max,
                desc=desc, keep=set(keep))




def x(id, query, **options):
    """Wikidata rows appended to an existing prompt in overrides.py (no new prompt)."""
    spec = w(id, 'x', query, '', '', '', **options)
    spec['extend'] = True
    return spec


def decade(start, end):
    """Feature films first released in [start, end)."""
    return ('SELECT DISTINCT ?item ?n WHERE { ?item wdt:P31 wd:Q11424 ; wikibase:sitelinks ?n . FILTER(?n >= __MIN__) '
            '?item wdt:P577 ?d . FILTER(YEAR(?d) >= %d && YEAR(?d) < %d) '
            'FILTER NOT EXISTS { ?item wdt:P577 ?e . FILTER(YEAR(?e) < %d) } }' % (start, end, start))


def film(*genres):
    return '?item wdt:P31 wd:Q11424 . ' + ' UNION '.join('{ ?item wdt:P136 wd:%s }' % g for g in genres) + ' '


def series(extra):
    return '?item wdt:P31/wdt:P279* wd:Q5398426 . ' + extra + ' '


def dishes(country):
    """Foods and dishes whose country of origin (P495) is `country`."""
    return '?item wdt:P495 wd:%s . ?item wdt:P31/wdt:P279* wd:Q2095 . ' % country


def settlements(country):
    return ('hint:Query hint:optimizer "None" . ?item wdt:P17 wd:%s ; wdt:P1082 [] ; wikibase:sitelinks ?n . '
            'FILTER(?n >= __MIN__) ?item wdt:P31/wdt:P279* wd:Q486972 . ' % country)


def works(*genres):
    """Literary works or novels with any of these genres."""
    return ('{ ?item wdt:P31 wd:Q7725634 } UNION { ?item wdt:P31 wd:Q8261 } UNION { ?item wdt:P31 wd:Q47461344 } . '
            + ' UNION '.join('{ ?item wdt:P136 wd:%s }' % g for g in genres) + ' ')


MYTH = '{ ?item wdt:P31/wdt:P279* wd:Q4271324 } '
P = dict(kind='person', min=10, cap=450)
F = dict(min=8, cap=450)
C = dict(common=True)
SPECS = [
    # People by field. Descriptions must name the field, so secondary occupations do not count.
    w('painters', 'a painter', occ('Q1028181'), 'Hieronymus Bosch', '', 'Pablo Picasso;Vincent van Gogh;Leonardo da Vinci;Claude Monet;Michelangelo', desc=r'paint|artist', keep=['Q762'], **P),
    w('composers', 'a composer', occ('Q36834'), 'Erik Satie', '', 'Wolfgang Amadeus Mozart;Ludwig van Beethoven;Johann Sebastian Bach;Frédéric Chopin;Pyotr Ilyich Tchaikovsky', {'Ludwig van Beethoven': ['Beethoven'], 'Johann Sebastian Bach': ['Bach', 'JS Bach'], 'Wolfgang Amadeus Mozart': ['Mozart']}, desc=r'compos', **P),
    w('physicists', 'a physicist', occ('Q169470'), 'Lise Meitner', '', 'Albert Einstein;Isaac Newton;Marie Curie;Stephen Hawking;Richard Feynman', desc=r'physic', **P),
    w('chemists', 'a chemist', occ('Q593644'), 'Rosalind Franklin', '', 'Marie Curie;Dmitri Mendeleev;Alfred Nobel;Louis Pasteur;Antoine Lavoisier', desc=r'chemi', **P),
    w('mathematicians', 'a mathematician', occ('Q170790'), 'Srinivasa Ramanujan', 'Paul Erdős', 'Isaac Newton;Pythagoras;Euclid;Leonhard Euler;Carl Friedrich Gauss', desc=r'mathemat', **P),
    w('philosophers', 'a philosopher', occ('Q4964182'), 'Diogenes of Sinope', '', 'Plato;Aristotle;Socrates;Immanuel Kant;Friedrich Nietzsche', desc=r'philosoph', **P),
    w('poets', 'a poet', occ('Q49757'), 'Rumi', '', 'William Shakespeare;Emily Dickinson;Robert Frost;Edgar Allan Poe;Walt Whitman', desc=r'poet', **P),
    w('playwrights', 'a playwright', occ('Q214917'), 'Molière', '', 'William Shakespeare;Arthur Miller;Tennessee Williams;Anton Chekhov;Oscar Wilde', desc=r'playwright|dramatist', **P),
    w('architects', 'an architect', occ('Q42973'), 'Christopher Wren', '', 'Frank Lloyd Wright;Antoni Gaudí;Zaha Hadid;Le Corbusier;I. M. Pei', desc=r'architect', **P),
    w('sculptors', 'a sculptor', occ('Q1281618'), 'Louise Bourgeois', '', 'Michelangelo;Auguste Rodin;Donatello;Gian Lorenzo Bernini;Alberto Giacometti', desc=r'sculpt', **P),
    w('photographers', 'a photographer', occ('Q33231'), 'Vivian Maier', '', 'Ansel Adams;Annie Leibovitz;Dorothea Lange;Henri Cartier-Bresson;Richard Avedon', desc=r'photograph', **P),
    w('directors', 'a film director', occ('Q2526255'), 'Hayao Miyazaki', '', 'Steven Spielberg;Alfred Hitchcock;Martin Scorsese;Quentin Tarantino;Christopher Nolan', desc=r'direct|filmmaker', **P),
    w('american-actors', 'an American actor or actress', occ('Q33999', 'Q10800557') + '?item wdt:P27 wd:Q30 .', 'Bill Murray', '', 'Tom Hanks;Meryl Streep;Leonardo DiCaprio;Denzel Washington;Marilyn Monroe', desc=r'act(or|ress)', **{**P, 'min': 20}),
    w('singers', 'a singer', occ('Q177220'), 'Nina Simone', '', 'Taylor Swift;Beyoncé;Michael Jackson;Elvis Presley;Adele', desc=r'singer|vocalist', **{**P, 'min': 20}),
    w('rappers', 'a rapper', occ('Q2252262'), 'MF Doom', '', 'Eminem;Drake;Kanye West;Jay-Z;Tupac Shakur', desc=r'rap|hip.?hop', **P),
    w('guitarists', 'a guitarist', occ('Q855091'), 'Django Reinhardt', '', 'Jimi Hendrix;Eric Clapton;Jimmy Page;Slash;Eddie Van Halen', desc=r'guitar', **P),
    w('drummers', 'a drummer', occ('Q386854'), 'Sheila E.', '', 'Ringo Starr;John Bonham;Dave Grohl;Neil Peart;Keith Moon', desc=r'drum|percussion', **P),
    w('pianists', 'a pianist', occ('Q486748'), 'Liberace', '', 'Frédéric Chopin;Franz Liszt;Lang Lang;Elton John;Glenn Gould', desc=r'pian', **P),
    w('jazz', 'a jazz musician', occ('Q15981151'), 'Thelonious Monk', '', 'Louis Armstrong;Miles Davis;John Coltrane;Duke Ellington;Ella Fitzgerald', desc=r'jazz', **P),
    w('comedians', 'a comedian', occ('Q245068', 'Q18545066'), 'Mitch Hedberg', '', 'Jerry Seinfeld;Robin Williams;Eddie Murphy;Kevin Hart;Dave Chappelle', desc=r'comedi|comic|humorist', **P),
    w('astronauts', 'an astronaut', occ('Q11631'), 'Chris Hadfield', '', 'Neil Armstrong;Buzz Aldrin;Yuri Gagarin;Sally Ride;John Glenn', desc=r'astronaut|cosmonaut|taikonaut|spationaut', **{**P, 'min': 5}),
    w('explorers', 'an explorer', occ('Q11900058'), 'Ernest Shackleton', '', 'Christopher Columbus;Ferdinand Magellan;Marco Polo;Vasco da Gama;James Cook', desc=r'explor|navigat|travel', **P),
    w('inventors', 'an inventor', occ('Q205375'), 'Hedy Lamarr', '', 'Thomas Edison;Nikola Tesla;Alexander Graham Bell;Benjamin Franklin;Johannes Gutenberg', desc=r'invent', **P),
    w('economists', 'an economist', occ('Q188094'), 'Thomas Robert Malthus', '', 'Adam Smith;John Maynard Keynes;Karl Marx;Milton Friedman;Friedrich Hayek', desc=r'econom', **P),
    w('psychologists', 'a psychologist', occ('Q212980'), 'Abraham Maslow', '', 'Sigmund Freud;Carl Jung;B. F. Skinner;Ivan Pavlov;Jean Piaget', desc=r'psycholog|psychiatr|psychoanal', **P),
    w('astronomers', 'an astronomer', occ('Q11063'), 'Tycho Brahe', '', 'Galileo Galilei;Nicolaus Copernicus;Johannes Kepler;Carl Sagan;Edwin Hubble', desc=r'astronom|astrophys', **P),
    w('biologists', 'a biologist', occ('Q864503'), 'Alfred Russel Wallace', '', 'Charles Darwin;Gregor Mendel;Jane Goodall;Carl Linnaeus;Rachel Carson', desc=r'biolog|zoolog|botan|naturalist|genetic|ecolog|primatolog|entomolog|ornitholog|microbio', **P),
    w('chefs', 'a chef', occ('Q3499072'), 'Auguste Escoffier', '', 'Gordon Ramsay;Julia Child;Anthony Bourdain;Jamie Oliver;Wolfgang Puck', desc=r'chef|cook|restaurat|culinar', **{**P, 'min': 5}),
    w('fashion-designers', 'a fashion designer', occ('Q3501317'), 'Vivienne Westwood', '', 'Coco Chanel;Giorgio Armani;Ralph Lauren;Gianni Versace;Christian Dior', desc=r'fashion|designer|couturi', **P),
    w('soccer-players', 'a soccer player', occ('Q937857'), 'Zlatan Ibrahimović', '', 'Lionel Messi;Cristiano Ronaldo;Pelé;Diego Maradona;Kylian Mbappé', desc=r'football|soccer', **{**P, 'min': 40}),
    w('basketball-players', 'a basketball player', occ('Q3665646'), 'Dennis Rodman', '', 'Michael Jordan;LeBron James;Kobe Bryant;Stephen Curry;Shaquille O\'Neal', desc=r'basketball', **{**P, 'min': 12}),
    w('baseball-players', 'a baseball player', occ('Q10871364'), 'Yogi Berra', '', 'Babe Ruth;Jackie Robinson;Derek Jeter;Shohei Ohtani;Willie Mays', desc=r'baseball', **{**P, 'min': 6}),
    w('nfl-players', 'an American football player', occ('Q19204627'), 'Deion Sanders', '', 'Tom Brady;Patrick Mahomes;Peyton Manning;Joe Montana;Jerry Rice', desc=r'football|quarterback|back|receiver|linebacker|kicker', **{**P, 'min': 5}),
    w('tennis-players', 'a tennis player', occ('Q10833314'), 'Björn Borg', '', 'Serena Williams;Roger Federer;Rafael Nadal;Novak Djokovic;Venus Williams', desc=r'tennis', **{**P, 'min': 15}),
    w('golfers', 'a golfer', occ('Q11303721'), 'Seve Ballesteros', '', 'Tiger Woods;Jack Nicklaus;Arnold Palmer;Phil Mickelson;Rory McIlroy', desc=r'golf', **{**P, 'min': 5}),
    w('boxers', 'a boxer', occ('Q11338576'), 'Sugar Ray Robinson', '', 'Muhammad Ali;Mike Tyson;Floyd Mayweather Jr.;Manny Pacquiao;Rocky Marciano', desc=r'box', **P),
    w('f1-drivers', 'a Formula One driver', occ('Q10841764'), 'James Hunt', '', 'Lewis Hamilton;Michael Schumacher;Ayrton Senna;Max Verstappen;Niki Lauda', desc=r'racing|formula|driver|racer|motor', **P),
    w('hockey-players', 'an ice hockey player', occ('Q11774891'), 'Gordie Howe', '', 'Wayne Gretzky;Sidney Crosby;Alexander Ovechkin;Mario Lemieux;Bobby Orr', desc=r'hockey', **{**P, 'min': 8}),
    w('cricketers', 'a cricketer', occ('Q12299841'), 'W. G. Grace', '', 'Sachin Tendulkar;Don Bradman;Virat Kohli;Shane Warne;Brian Lara', desc=r'cricket', **{**P, 'min': 6}),
    w('chess-players', 'a chess player', occ('Q10873124'), 'Judit Polgár', '', 'Magnus Carlsen;Garry Kasparov;Bobby Fischer;Hikaru Nakamura;Anatoly Karpov', desc=r'chess', **P),
    w('swimmers', 'a swimmer', occ('Q10843402'), 'Johnny Weissmuller', '', 'Michael Phelps;Katie Ledecky;Mark Spitz;Ian Thorpe;Ryan Lochte', desc=r'swim', **P),
    w('track-athletes', 'a track and field athlete', occ('Q11513337'), 'Eliud Kipchoge', '', 'Usain Bolt;Carl Lewis;Jesse Owens;Florence Griffith Joyner;Mo Farah', desc=r'athlet|sprint|runner|hurdl|jump|throw|decathl|heptathl|marathon|distance|vault', **{**P, 'min': 15}),
    w('figure-skaters', 'a figure skater', occ('Q13219587'), 'Surya Bonaly', '', 'Michelle Kwan;Yuzuru Hanyu;Kristi Yamaguchi;Tonya Harding;Nathan Chen', desc=r'skat', **P),
    w('cyclists', 'a professional cyclist', occ('Q2309784'), 'Marco Pantani', '', 'Lance Armstrong;Eddy Merckx;Chris Froome;Tadej Pogačar;Greg LeMond', desc=r'cycl', **P),
    w('skiers', 'an alpine skier', occ('Q4144610'), 'Franz Klammer', '', 'Lindsey Vonn;Mikaela Shiffrin;Bode Miller;Ingemar Stenmark;Hermann Maier', desc=r'ski', **P),
    w('gymnasts', 'a gymnast', occ('Q13381572', 'Q16947675'), 'Olga Korbut', '', 'Simone Biles;Nadia Comăneci;Gabby Douglas;Kohei Uchimura;Aly Raisman', desc=r'gymnast', **P),
    w('pro-wrestlers', 'a professional wrestler', occ('Q13474373'), 'André the Giant', '', 'Hulk Hogan;Dwayne Johnson;John Cena;The Undertaker;Stone Cold Steve Austin', desc=r'wrestl', **P),
    w('mma-fighters', 'a mixed martial artist', occ('Q11607585'), 'Georges St-Pierre', '', 'Conor McGregor;Ronda Rousey;Jon Jones;Khabib Nurmagomedov;Anderson Silva', desc=r'martial|fighter|mma', **P),
    w('historians', 'a historian', occ('Q201788'), 'Plutarch', '', 'Herodotus;Thucydides;Edward Gibbon;Howard Zinn;Yuval Noah Harari', desc=r'histor', **P),
    w('childrens-authors', "a children's author", occ('Q4853732'), 'Shel Silverstein', '', 'Dr. Seuss;Roald Dahl;Beatrix Potter;J. K. Rowling;Maurice Sendak', desc=r'child|writer|author|illustrat|novelist|poet', **P),
    w('scifi-authors', 'a science fiction author', occ('Q18844224'), 'Octavia E. Butler', '', 'Isaac Asimov;Philip K. Dick;Ray Bradbury;Arthur C. Clarke;H. G. Wells', desc=r'fiction|writer|author|novelist', **P),
    w('youtubers', 'a YouTuber', occ('Q17125263'), 'Mark Rober', '', 'MrBeast;PewDiePie;Markiplier;Jacksepticeye;Casey Neistat', desc=r'you.?tub|internet|vlog|stream|influencer|content|comedian|gamer|personality|creator', **{**P, 'min': 5}),
    w('cartoonists', 'a cartoonist or comic artist', occ('Q1114448', 'Q715301'), 'Hergé', '', 'Charles M. Schulz;Stan Lee;Jim Davis;Bill Watterson;Osamu Tezuka', desc=r'cartoon|comic|illustrat|manga|animat', **P),
    w('opera-singers', 'an opera singer', occ('Q2865819'), 'Enrico Caruso', '', 'Luciano Pavarotti;Plácido Domingo;Maria Callas;Andrea Bocelli;José Carreras', desc=r'opera|soprano|tenor|baritone|mezzo|bass|contralto|singer', **P),
    w('country-singers', 'a country music artist', '?item wdt:P31 wd:Q5 ; wdt:P136 wd:Q83440 .', 'Patsy Cline', '', 'Dolly Parton;Johnny Cash;Garth Brooks;Willie Nelson;Shania Twain', desc=r'country|singer|songwriter|musician', **P),
    w('djs', 'a DJ or electronic music producer', occ('Q130857'), 'Deadmau5', '', 'Calvin Harris;David Guetta;Avicii;Tiësto;Skrillex', desc=r'dj|disc jockey|producer|electronic', **P),
    w('entrepreneurs', 'an entrepreneur', '?item wdt:P31 wd:Q5 . { ?item wdt:P106 wd:Q131524 } UNION { ?item wdt:P106 wd:Q43845 } ', 'Madam C. J. Walker', '', 'Elon Musk;Steve Jobs;Bill Gates;Jeff Bezos;Mark Zuckerberg', desc=r'entrepreneur|business|founder|investor|executive|magnate|industrialist|ceo', **{**P, 'min': 20}),
    w('violinists', 'a violinist', occ('Q1259917'), 'Lindsey Stirling', '', 'Niccolò Paganini;Itzhak Perlman;Joshua Bell;Hilary Hahn;Antonio Vivaldi', desc=r'violin|fiddl', **P),
    w('conductors', 'an orchestra conductor', occ('Q158852'), 'Leopold Stokowski', '', 'Leonard Bernstein;Herbert von Karajan;Arturo Toscanini;Gustavo Dudamel;Seiji Ozawa', desc=r'conduct', **P),
    w('monarchs', 'a king, queen or emperor', '?item wdt:P31 wd:Q5 . { ?item wdt:P106 wd:Q116 } UNION { ?item wdt:P39 ?pos . ?pos wdt:P279* wd:Q116 } ', 'Tutankhamun', '', 'Elizabeth II;Henry VIII of England;Louis XIV of France;Victoria;Napoleon', {'Victoria': ['Queen Victoria']}, desc=r'king|queen|emperor|empress|monarch|sultan|tsar|czar|pharaoh|shah|emir|ruler|sovereign|khan', **{**P, 'min': 25}),
    w('ballet-dancers', 'a ballet dancer', occ('Q805221'), 'Margot Fonteyn', '', 'Mikhail Baryshnikov;Rudolf Nureyev;Anna Pavlova;Misty Copeland;Vaslav Nijinsky', desc=r'ballet|danc', **{**P, 'min': 6}),
    w('magicians', 'a magician', occ('Q15855449'), 'Ricky Jay', '', 'Harry Houdini;David Copperfield;David Blaine;Penn Jillette;Criss Angel', desc=r'magic|illusion|escap|mentalist', **{**P, 'min': 3}),
    w('rugby-players', 'a rugby player', occ('Q14089670', 'Q13415036'), 'Gareth Edwards', '', 'Jonah Lomu;Richie McCaw;Jonny Wilkinson;Dan Carter;Martin Johnson', desc=r'rugby', **{**P, 'min': 6}),
    w('tv-hosts', 'a TV host or presenter', occ('Q947873'), 'Fred Rogers', '', 'Oprah Winfrey;Ellen DeGeneres;Jimmy Fallon;David Letterman;Johnny Carson', desc=r'present|host|anchor|broadcast|personality|comedian', **{**P, 'min': 20}),
    w('mountaineers', 'a mountaineer', occ('Q9149093'), 'Junko Tabei', '', 'Edmund Hillary;Tenzing Norgay;Reinhold Messner;George Mallory;Alex Honnold', desc=r'mountain|climb|alpinist', **{**P, 'min': 5}),
    w('animators', 'an animator', occ('Q266569'), 'Ray Harryhausen', '', 'Walt Disney;Hayao Miyazaki;Chuck Jones;Tex Avery;John Lasseter', desc=r'animat|cartoon', **{**P, 'min': 5}),
    w('computer-scientists', 'a computer scientist', occ('Q82594'), 'Donald Knuth', '', 'Alan Turing;Ada Lovelace;Grace Hopper;Tim Berners-Lee;Linus Torvalds', desc=r'comput|program|software|cryptograph|mathemat|engineer', **P),
    w('nobel-laureates', 'a Nobel Prize winner', '?item wdt:P166 ?prize . VALUES ?prize { wd:Q38104 wd:Q44585 wd:Q80061 wd:Q37922 wd:Q35637 wd:Q47170 } ', 'Bob Dylan', '', 'Albert Einstein;Marie Curie;Martin Luther King Jr.;Nelson Mandela;Malala Yousafzai', **{**P, 'min': 3}),
    w('oscar-actors', 'an Oscar-winning actor or actress', '?item wdt:P166 ?prize . VALUES ?prize { wd:Q103916 wd:Q103618 wd:Q106291 wd:Q106301 } ', 'Marlee Matlin', '', 'Meryl Streep;Tom Hanks;Daniel Day-Lewis;Katharine Hepburn;Leonardo DiCaprio', **{**P, 'min': 3}),

    # Fictional characters.
    w('superheroes', 'a superhero', '{ ?item wdt:P106 wd:Q188784 } UNION { ?item wdt:P31/wdt:P279* wd:Q188784 } ', 'Squirrel Girl', '', 'Superman;Batman;Spider-Man;Wonder Woman;Iron Man', fictional=True, min=3),
    w('marvel', 'a Marvel character', inst('Q1114461', sub=True), 'Howard the Duck', '', 'Spider-Man;Iron Man;Captain America;Thor;Hulk', fictional=True, min=3, desc=r'\bMarvel'),
    w('dc', 'a DC Comics character', inst('Q1114461', sub=True), 'Swamp Thing', '', 'Batman;Superman;Wonder Woman;Joker;Aquaman', fictional=True, min=3, desc=r'\bDC\b'),
    w('harry-potter', 'a Harry Potter character', '?item wdt:P1080 wd:Q5410773 . ?item wdt:P31/wdt:P279* wd:Q95074 .', 'Dobby', '', 'Harry Potter;Hermione Granger;Ron Weasley;Albus Dumbledore;Lord Voldemort', fictional=True, min=1),
    w('simpsons', 'a Simpsons character', '?item wdt:P1441 wd:Q886 . ?item wdt:P31/wdt:P279* wd:Q95074 .', 'Hans Moleman', '', 'Homer Simpson;Bart Simpson;Marge Simpson;Lisa Simpson;Maggie Simpson', fictional=True, min=1),
    w('game-characters', 'a video game character', inst('Q1569167', sub=True), 'Waluigi', '', 'Mario;Sonic the Hedgehog;Link;Pikachu;Pac-Man', fictional=True, min=3),
    w('cartoon-characters', 'a cartoon character', inst('Q15711870', sub=True), 'Snagglepuss', '', 'Mickey Mouse;Bugs Bunny;SpongeBob SquarePants;Homer Simpson;Scooby-Doo', fictional=True, min=3),
    w('anime-characters', 'an anime or manga character', inst('Q80447738', 'Q87576284', sub=True), 'Totoro', '', 'Naruto Uzumaki;Goku;Monkey D. Luffy;Sasuke Uchiha;Light Yagami', fictional=True, min=3, desc=r'anime|manga|japan|pok[eé]mon|ghibli|dragon ball|naruto|one piece|sailor|gundam|light novel'),
    w('greek-myth', 'a figure from Greek mythology', MYTH + 'UNION { ?item wdt:P31/wdt:P279* wd:Q22989102 } ', 'Sisyphus', '', 'Zeus;Heracles;Achilles;Medusa;Odysseus', {'Heracles': ['Hercules']}, fictional=True, min=3, desc=r'Greek|Olymp|Titan|Trojan|Argonaut|Hellen'),
    w('norse-myth', 'a figure from Norse mythology', MYTH + 'UNION { ?item wdt:P31/wdt:P279* wd:Q16513881 } ', 'Ratatoskr', '', 'Thor;Odin;Loki;Freyja;Baldr', fictional=True, min=2, desc=r'Norse|Edda|Æsir|Aesir|Vanir|jötunn|Asgard|Valhalla|Viking'),
    w('literary-characters', 'a character from a novel', inst('Q3658341', sub=True), 'Atticus Finch', '', 'Sherlock Holmes;Harry Potter;Elizabeth Bennet;Jay Gatsby;Frodo Baggins', fictional=True, min=5, desc=r'^(?!.*comic)(?=.*(novel|book|story|stories|play|poem|literary|tale|saga|narrative))'),

    # Films.
    w('films-classic', 'a movie released before 1960', '?item wdt:P31 wd:Q11424 ; wikibase:sitelinks ?n . FILTER(?n >= __MIN__) ?item wdt:P577 ?d . FILTER(YEAR(?d) < 1960) ', 'Nosferatu', '', 'Casablanca;Gone with the Wind;Citizen Kane;The Wizard of Oz;Snow White and the Seven Dwarfs', **F),
    w('films-1960s', 'a movie from the 1960s', decade(1960, 1970), 'Barbarella', '', 'Psycho;The Sound of Music;2001: A Space Odyssey;Dr. No;Breakfast at Tiffany\'s', **F),
    w('films-1970s', 'a movie from the 1970s', decade(1970, 1980), 'Monty Python and the Holy Grail', '', 'The Godfather;Star Wars: Episode IV – A New Hope;Jaws;Rocky;Grease', **F),
    w('films-1980s', 'a movie from the 1980s', decade(1980, 1990), 'The Princess Bride', '', 'Back to the Future;E.T. the Extra-Terrestrial;The Breakfast Club;Ghostbusters;Top Gun', **F),
    w('films-1990s', 'a movie from the 1990s', decade(1990, 2000), 'Groundhog Day', '', 'Titanic;Jurassic Park;The Lion King;Pulp Fiction;Forrest Gump', **F),
    w('films-2000s', 'a movie from the 2000s', decade(2000, 2010), 'Napoleon Dynamite', '', 'The Dark Knight;Avatar;Shrek;Finding Nemo;Gladiator', **F),
    w('films-2010s', 'a movie from the 2010s', decade(2010, 2020), 'Paddington 2', '', 'Inception;Frozen;Avengers: Endgame;Black Panther;Toy Story 3', **F),
    w('films-2020s', 'a movie from the 2020s', decade(2020, 2030), 'The Banshees of Inisherin', '', 'Barbie;Oppenheimer;Dune;Top Gun: Maverick;Everything Everywhere All at Once', **F),
    w('scifi-films', 'a science fiction movie', film('Q471839'), 'Galaxy Quest', '', 'Star Wars: Episode IV – A New Hope;Blade Runner;The Matrix;Alien;2001: A Space Odyssey', **F),
    w('fantasy-films', 'a fantasy movie', film('Q157394'), 'Labyrinth', '', 'Shrek;Harry Potter and the Philosopher\'s Stone;The Wizard of Oz;Pan\'s Labyrinth;The Princess Bride', **F),
    w('animated-films', 'an animated movie', '{ ?item wdt:P31 wd:Q202866 } UNION { ?item wdt:P31 wd:Q11424 ; wdt:P136 wd:Q202866 } ', 'My Neighbor Totoro', '', 'Toy Story;The Lion King;Frozen;Shrek;Finding Nemo', **F),
    w('romance-films', 'a romance movie', film('Q1054574'), 'Before Sunrise', '', 'Titanic;The Notebook;Casablanca;Notting Hill;La La Land', **F),
    w('westerns', 'a western movie', film('Q172980'), 'Blazing Saddles', '', 'The Good, the Bad and the Ugly;Unforgiven;Django Unchained;True Grit;High Noon', **F),
    w('musical-films', 'a movie musical', film('Q842256'), 'The Rocky Horror Picture Show', '', 'The Sound of Music;Grease;The Wizard of Oz;Mamma Mia!;La La Land', **F),
    w('war-films', 'a war movie', film('Q369747'), 'The Great Escape', '', 'Saving Private Ryan;Apocalypse Now;Full Metal Jacket;Dunkirk;Platoon', **F),
    w('crime-films', 'a crime movie', film('Q959790'), 'Fargo', '', 'The Godfather;Goodfellas;Pulp Fiction;Scarface;The Departed', **F),
    w('superhero-films', 'a superhero movie', film('Q1535153'), 'Mystery Men', '', 'The Dark Knight;Avengers: Endgame;Spider-Man;Iron Man;Black Panther', **{**F, 'min': 3}),
    w('christmas-films', 'a Christmas movie', film('Q28026639'), 'Gremlins', '', 'Home Alone;Elf;It\'s a Wonderful Life;The Polar Express;Love Actually', **{**F, 'min': 2}),
    w('teen-films', 'a teen movie', film('Q1146335'), 'Heathers', '', 'Mean Girls;The Breakfast Club;Clueless;Superbad;Ferris Bueller\'s Day Off', **{**F, 'min': 4}),
    w('spy-films', 'a spy movie', film('Q2297927'), 'Spies Like Us', '', 'Mission: Impossible;Skyfall;The Bourne Identity;Casino Royale;Goldfinger', **{**F, 'min': 4}),
    w('martial-arts-films', 'a martial arts movie', film('Q1033891'), 'Kung Fu Hustle', '', 'Enter the Dragon;Crouching Tiger, Hidden Dragon;Kill Bill: Volume 1;Kung Fu Panda;Ip Man', **{**F, 'min': 4}),
    w('biopics', 'a biographical movie', film('Q645928'), 'Ed Wood', '', 'The Social Network;Bohemian Rhapsody;Schindler\'s List;Oppenheimer;The Theory of Everything', **F),
    w('romcoms', 'a romantic comedy movie', film('Q860626'), 'Moonstruck', '', 'When Harry Met Sally...;Notting Hill;Pretty Woman;Crazy Rich Asians;10 Things I Hate About You', **F),
    w('mystery-films', 'a mystery movie', film('Q1200678'), 'Clue', '', 'Knives Out;Gone Girl;Murder on the Orient Express;Chinatown;Vertigo', **F),
    w('adventure-films', 'an adventure movie', film('Q319221'), 'Romancing the Stone', '', 'Raiders of the Lost Ark;Jurassic Park;Indiana Jones and the Last Crusade;The Goonies;Jumanji', **F),
    w('disney-films', 'a Disney movie', '?item wdt:P31 wd:Q11424 . { ?item wdt:P272 wd:Q191224 } UNION { ?item wdt:P272 wd:Q1047410 } UNION { ?item wdt:P272 wd:Q127552 } ', "The Emperor's New Groove", '', 'The Lion King;Frozen;Aladdin;Beauty and the Beast;Toy Story', **{**F, 'min': 3}),
    w('bollywood', 'a Bollywood movie', '?item wdt:P31 wd:Q11424 ; wdt:P364 wd:Q1568 ; wdt:P495 wd:Q668 .', 'Kuch Kuch Hota Hai', '', 'Dilwale Dulhania Le Jayenge;3 Idiots;Lagaan;Sholay;Dangal', **{**F, 'min': 4}),
    w('japanese-films', 'a Japanese movie', '?item wdt:P31 wd:Q11424 ; wdt:P495 wd:Q17 ; wdt:P364 wd:Q5287 .', 'Tampopo', '', 'Spirited Away;Seven Samurai;Godzilla;My Neighbor Totoro;Akira', **F),
    w('french-films', 'a French movie', '?item wdt:P31 wd:Q11424 ; wdt:P495 wd:Q142 ; wdt:P364 wd:Q150 .', 'The Red Balloon', '', 'Amélie;The Intouchables;Breathless;La Haine;The 400 Blows', **{**F, 'min': 15}),

    # Television.
    w('sitcoms', 'a sitcom', series('?item wdt:P136 wd:Q170238 .'), 'Arrested Development', '', 'Friends;Seinfeld;The Office;Parks and Recreation;How I Met Your Mother', min=5),
    w('animated-series', 'an animated TV series', inst('Q117467246', 'Q581714'), 'Gravity Falls', '', 'The Simpsons;SpongeBob SquarePants;Family Guy;South Park;Avatar: The Last Airbender', min=5),
    w('reality-tv', 'a reality TV show', '?item wdt:P136 wd:Q182415 .', 'The Great British Bake Off', '', 'Survivor;Big Brother;The Bachelor;Keeping Up with the Kardashians;The Amazing Race', min=3),
    w('game-shows', 'a TV game show', '{ ?item wdt:P31 wd:Q846662 } UNION { ?item wdt:P136 wd:Q846662 } ', "Takeshi's Castle", '', 'Jeopardy!;Wheel of Fortune;The Price Is Right;Who Wants to Be a Millionaire?;Family Feud', min=3),
    w('soap-operas', 'a soap opera', series('{ ?item wdt:P31 wd:Q23739 } UNION { ?item wdt:P136 wd:Q23739 }'), 'Neighbours', '', 'Days of Our Lives;General Hospital;The Young and the Restless;EastEnders;Coronation Street', min=3),
    w('anime', 'an anime series', inst('Q63952888'), 'Cowboy Bebop', '', 'Naruto;Dragon Ball Z;One Piece;Attack on Titan;Pokémon', min=5),
    w('british-tv', 'a British TV show', series('?item wdt:P495 wd:Q145 .'), 'Blackadder', '', 'Doctor Who;Sherlock;The Office;Downton Abbey;Fawlty Towers', min=5),
    w('netflix', 'a Netflix original series', '?item wdt:P449 wd:Q907311 .', 'BoJack Horseman', '', 'Stranger Things;Squid Game;The Crown;Bridgerton;Wednesday', min=5),
    w('hbo', 'an HBO series', '?item wdt:P449 wd:Q23633 .', 'Flight of the Conchords', '', 'Game of Thrones;The Sopranos;The Wire;Succession;Sex and the City', min=3),
    w('kids-tv', "a children's TV show", series('{ ?item wdt:P31 wd:Q1273568 } UNION { ?item wdt:P136 wd:Q1273568 }'), 'Bill Nye the Science Guy', '', 'Sesame Street;Barney & Friends;Mister Rogers\' Neighborhood;Blue\'s Clues;Teletubbies', min=3),
    w('k-dramas', 'a Korean TV drama', series('?item wdt:P495 wd:Q884 .'), 'Extraordinary Attorney Woo', '', 'Crash Landing on You;Squid Game;Descendants of the Sun;Guardian: The Lonely and Great God;Itaewon Class', min=3),
    w('tv-channels', 'a TV channel or network', inst('Q2001305', 'Q141683'), 'The Weather Channel', '', 'CNN;ESPN;HBO;MTV;BBC One', min=5),

    # Books, writing and comics.
    w('scifi-books', 'a science fiction novel', works('Q24925', 'Q12132683'), 'The Martian', '', 'Dune;Nineteen Eighty-Four;Brave New World;Fahrenheit 451;The Hitchhiker\'s Guide to the Galaxy', {'Nineteen Eighty-Four': ['1984']}, min=4),
    w('fantasy-books', 'a fantasy novel', works('Q132311', 'Q59342621'), "Howl's Moving Castle", '', 'The Hobbit;The Lord of the Rings;A Game of Thrones;Harry Potter and the Philosopher\'s Stone;The Lion, the Witch and the Wardrobe', min=3),
    w('mystery-books', 'a mystery or crime novel', works('Q186424', 'Q208505', 'Q20664817'), 'The Moonstone', '', 'The Hound of the Baskervilles;Murder on the Orient Express;The Girl with the Dragon Tattoo;Gone Girl;And Then There Were None', min=3),
    w('classic-novels', 'a novel published before 1900', '{ ?item wdt:P31 wd:Q8261 } UNION { ?item wdt:P7937 wd:Q8261 } ?item wdt:P577 ?d . FILTER(YEAR(?d) < 1900) ', 'Three Men in a Boat', '', 'Pride and Prejudice;Moby-Dick;Frankenstein;Great Expectations;War and Peace', min=5),
    w('comic-strips', 'a comic strip', inst('Q838795'), 'Krazy Kat', '', 'Peanuts;Garfield;Calvin and Hobbes;The Far Side;Dilbert', min=3),
    w('manga', 'a manga series', inst('Q21198342'), "Chi's Sweet Home", '', 'One Piece;Naruto;Dragon Ball;Attack on Titan;Death Note', min=5),
    w('comic-books', 'a comic book series', inst('Q14406742'), 'Bone', '', 'Watchmen;The Amazing Spider-Man;Batman;Superman;X-Men', min=3),
    w('fairy-tales', 'a fairy tale', inst('Q699', sub=True), 'Rumpelstiltskin', '', 'Cinderella;Snow White;Little Red Riding Hood;Hansel and Gretel;Rapunzel', min=2),

    # Music.
    w('albums', 'an album', inst('Q482994'), 'Pet Sounds', '', 'Thriller;Abbey Road;The Dark Side of the Moon;Back in Black;Rumours', min=20, cap=600),
    w('songs', 'a song', inst('Q7366', 'Q134556'), 'Never Gonna Give You Up', '', 'Bohemian Rhapsody;Imagine;Yesterday;Hey Jude;Billie Jean', min=20, cap=600),
    w('ballets', 'a ballet', inst('Q15079786'), 'Coppélia', '', 'Swan Lake;The Nutcracker;Giselle;The Sleeping Beauty;Romeo and Juliet', min=2),
    w('rock-bands', 'a rock band', inst('Q5741069'), 'Tenacious D', '', 'The Beatles;Queen;Led Zeppelin;The Rolling Stones;Nirvana', min=10),
    w('metal-bands', 'a heavy metal band', '?item wdt:P136 wd:Q38848 . { ?item wdt:P31 wd:Q215380 } UNION { ?item wdt:P31 wd:Q5741069 } ', 'Motörhead', '', 'Metallica;Iron Maiden;Black Sabbath;Slayer;Megadeth', min=5),
    w('boy-bands', 'a boy band', inst('Q216337'), 'Hanson', '', 'Backstreet Boys;NSYNC;One Direction;BTS;New Kids on the Block', min=2),
    w('girl-groups', 'a girl group', inst('Q641066'), 'Bananarama', '', 'Spice Girls;Destiny\'s Child;Little Mix;Blackpink;The Supremes', min=2),
    w('kpop', 'a K-pop group', '?item wdt:P136 wd:Q213665 . { ?item wdt:P31 wd:Q215380 } UNION { ?item wdt:P31 wd:Q216337 } UNION { ?item wdt:P31 wd:Q641066 } ', 'NewJeans', '', 'BTS;Blackpink;Twice;EXO;Stray Kids', min=2),
    w('music-festivals', 'a music festival', inst('Q868557', sub=True), 'Tomorrowland', '', 'Coachella Valley Music and Arts Festival;Glastonbury Festival;Lollapalooza;Woodstock;Bonnaroo Music Festival', {'Coachella Valley Music and Arts Festival': ['Coachella']}, min=3),
    w('record-labels', 'a record label', inst('Q18127'), 'Sub Pop', '', 'Columbia Records;Motown;Atlantic Records;Def Jam Recordings;Sony Music', min=5),

    # Art and games.
    w('sculptures', 'a famous sculpture or statue', inst('Q860861', 'Q179700'), 'Manneken Pis', '', 'David;The Thinker;Venus de Milo;Statue of Liberty;Christ the Redeemer', min=10),
    w('video-games', 'a video game', inst('Q7889'), 'Untitled Goose Game', '', 'Minecraft;Tetris;Super Mario Bros.;Fortnite;Grand Theft Auto V', min=20, cap=600),
    w('nintendo-games', 'a Nintendo game', '?item wdt:P31 wd:Q7889 . { ?item wdt:P123 wd:Q8093 } UNION { ?item wdt:P178 wd:Q8093 } ', 'Nintendogs', '', 'Super Mario Bros.;The Legend of Zelda;Mario Kart 8;Super Smash Bros.;Animal Crossing: New Horizons', min=3),
    w('game-series', 'a video game series', inst('Q7058673'), 'Katamari', '', 'Super Mario;The Legend of Zelda;Pokémon;Call of Duty;Grand Theft Auto', min=5),
    w('card-games', 'a card game', inst('Q142714', sub=True) + 'UNION ' + kinds('Q142714'), 'Egyptian Ratscrew', '', 'Poker;Uno;Go Fish;Solitaire;Blackjack', min=2, **C),
    w('toys', 'a toy', inst('Q11422', sub=True) + 'UNION ' + kinds('Q11422'), 'Slinky', '', 'Lego;Barbie;Rubik\'s Cube;Teddy bear;Yo-yo', min=3, **C),

    # Brands, companies and technology.
    w('car-models', 'a car model', inst('Q3231690'), 'DeLorean DMC-12', '', 'Ford Mustang;Toyota Corolla;Volkswagen Beetle;Honda Civic;Tesla Model S', min=8),
    w('airlines', 'an airline', inst('Q46970'), 'Hawaiian Airlines', '', 'Delta Air Lines;American Airlines;United Airlines;Emirates;British Airways', min=8),
    w('airports', 'an airport', inst('Q1248784', sub=True), 'Princess Juliana International Airport', '', 'Heathrow Airport;John F. Kennedy International Airport;Los Angeles International Airport;O\'Hare International Airport;Dubai International Airport', kind='airport', min=15),
    w('restaurant-chains', 'a restaurant chain', inst('Q18534542', 'Q18509232', sub=True), 'In-N-Out Burger', '', 'McDonald\'s;Burger King;KFC;Subway;Starbucks', min=3),
    w('retailers', 'a store chain', inst('Q507619', 'Q18043413', sub=True), "Trader Joe's", '', 'Walmart;Target;Costco;IKEA;Tesco', min=5, exclude_types=['Q18534542', 'Q18509232']),
    w('soft-drinks', 'a soft drink', inst('Q147538', sub=True) + 'UNION ' + kinds('Q147538'), 'Irn-Bru', '', 'Coca-Cola;Pepsi;Sprite;Fanta;Dr Pepper', min=2),
    w('candy', 'a candy or chocolate bar', inst('Q185583', sub=True) + 'UNION ' + kinds('Q185583'), 'Pop Rocks', '', 'M&M\'s;Snickers;Skittles;Kit Kat;Twix', min=2),
    w('beer-brands', 'a beer brand', inst('Q15075508', sub=True), 'Pabst Blue Ribbon', '', 'Budweiser;Heineken;Guinness;Corona;Stella Artois', min=2),
    w('magazines', 'a magazine', inst('Q41298'), 'Mad', '', 'Time;Vogue;National Geographic;The New Yorker;Rolling Stone', min=8),
    w('banks', 'a bank', inst('Q22687', sub=True), 'Banca Monte dei Paschi di Siena', '', 'JPMorgan Chase;Bank of America;HSBC;Goldman Sachs;Wells Fargo', min=10),
    w('game-studios', 'a video game company', inst('Q210167', 'Q1137109'), 'Supergiant Games', '', 'Nintendo;Ubisoft;Electronic Arts;Rockstar Games;Valve Corporation', min=4),
    w('motorcycles', 'a motorcycle brand', inst('Q15081030'), 'Royal Enfield', '', 'Harley-Davidson;Ducati;Yamaha Motor Company;Honda;Kawasaki Heavy Industries', min=2),
    w('websites', 'a website', inst('Q35127', sub=True), 'Neopets', '', 'YouTube;Wikipedia;Facebook;Reddit;Google Search', min=10),
    w('apps', 'a mobile app', inst('Q620615', sub=True), 'Duolingo', '', 'Instagram;WhatsApp;TikTok;Snapchat;Uber', min=5),
    w('programming-languages', 'a programming language', inst('Q9143', sub=True), 'Scratch', '', 'Python;Java;JavaScript;C;Rust', {'C': ['C plus plus', 'cpp', 'C sharp', 'csharp']}, min=5),
    w('operating-systems', 'an operating system', inst('Q9135', sub=True), 'BeOS', '', 'Microsoft Windows;macOS;Linux;Android;iOS', {'Microsoft Windows': ['Windows']}, min=4),
    w('fonts', 'a font or typeface', inst('Q17451', sub=True), 'Papyrus', '', 'Helvetica;Times New Roman;Arial;Comic Sans;Garamond', min=2),
    w('hotel-chains', 'a hotel chain', inst('Q1631129'), 'Motel 6', '', 'Hilton Hotels & Resorts;Marriott International;Holiday Inn;Hyatt;Best Western', min=2),

    # Food and drink.
    w('italian-food', 'an Italian food or dish', dishes('Q38'), 'Cacio e pepe', '', 'Pizza;Spaghetti;Lasagna;Risotto;Tiramisu', min=2, **C),
    w('french-food', 'a French food or dish', dishes('Q142'), 'Croque monsieur', '', 'Croissant;Crêpe;Baguette;Ratatouille;Quiche', min=2, **C),
    w('desserts', 'a dessert', inst('Q182940', sub=True) + 'UNION ' + kinds('Q182940'), 'Baked Alaska', '', 'Ice cream;Cake;Brownie;Cheesecake;Apple pie', min=3, **C),
    w('cakes', 'a type of cake', inst('Q13276', sub=True) + 'UNION ' + kinds('Q13276'), 'Baumkuchen', '', 'Cheesecake;Carrot cake;Chocolate cake;Red velvet cake;Sponge cake', min=1, **C),
    w('cookies', 'a cookie or biscuit', inst('Q13266', 'Q13270', sub=True) + 'UNION ' + kinds('Q13266', 'Q13270'), 'Stroopwafel', '', 'Chocolate chip cookie;Shortbread;Oreo;Snickerdoodle;Gingerbread', min=1, **C),
    w('breads', 'a type of bread', inst('Q7802', sub=True) + 'UNION ' + kinds('Q7802'), 'Pumpernickel', '', 'Baguette;Sourdough;Bagel;Naan;Pita', min=2, **C),
    w('soups', 'a soup', inst('Q41415', sub=True) + 'UNION ' + kinds('Q41415'), 'Borscht', '', 'Chicken soup;Tomato soup;Minestrone;French onion soup;Clam chowder', min=2, **C),
    w('pastries', 'a pastry', inst('Q477248', sub=True) + 'UNION ' + kinds('Q477248'), 'Kouign-amann', '', 'Croissant;Danish pastry;Éclair;Cannoli;Baklava', min=1, **C),
    w('pasta', 'a pasta shape or dish', inst('Q178', sub=True) + 'UNION ' + kinds('Q178'), 'Orecchiette', '', 'Spaghetti;Penne;Fettuccine;Macaroni;Ravioli', min=1, **C),
    w('salads', 'a salad', inst('Q9266', sub=True) + 'UNION ' + kinds('Q9266'), 'Tabbouleh', '', 'Caesar salad;Greek salad;Caprese salad;Coleslaw;Waldorf salad', min=1, **C),
    w('noodles', 'a noodle or noodle dish', inst('Q192874', sub=True) + 'UNION ' + kinds('Q192874'), 'Biangbiang noodles', '', 'Ramen;Udon;Soba;Rice noodles;Lo mein', min=1, **C),
    w('wine-grapes', 'a wine grape variety', inst('Q958314', sub=True), 'Gewürztraminer', '', 'Chardonnay;Merlot;Pinot noir;Cabernet Sauvignon;Sauvignon blanc', min=2, **C),
    w('liqueurs', 'a liqueur or spirit', inst('Q178780', 'Q56139', sub=True) + 'UNION ' + kinds('Q178780', 'Q56139'), 'Chartreuse', '', 'Vodka;Whisky;Rum;Gin;Tequila', min=2, **C),

    # Animals, plants and other living things.
    w('mammals', 'a mammal', taxon('Q7377', 25), 'Okapi', 'Pangolin', 'Dog;Cat;Lion;Elephant;Horse', kind='taxon', min=12, **C),
    w('reptiles', 'a reptile', taxon('Q10811', 25, stop=['Q5113']), 'Thorny devil', '', 'Snake;Lizard;Crocodile;Turtle;Iguana', kind='taxon', min=8, **C),
    w('amphibians', 'an amphibian', taxon('Q10908', 20), 'Olm', '', 'Frog;Toad;Salamander;Newt;Axolotl', kind='taxon', min=5, **C),
    w('cattle', 'a cattle breed', inst('Q12045585'), 'Highland cattle', '', 'Holstein Friesian cattle;Angus cattle;Hereford cattle;Jersey cattle;Texas Longhorn', min=1, **C),
    w('chickens', 'a chicken breed', inst('Q15304943'), 'Ayam Cemani', '', 'Leghorn;Rhode Island Red;Silkie;Plymouth Rock;Orpington', min=1, **C),
    w('sheep', 'a sheep breed', inst('Q15622363'), 'Valais Blacknose', '', 'Merino;Suffolk;Dorset Horn;Jacob;Shetland', min=1, **C),
    w('goats', 'a goat breed', inst('Q15622387'), 'Pygmy goat', '', 'Boer goat;Nubian;Alpine goat;Angora goat;Saanen', min=1, **C),
    w('minerals', 'a mineral', inst('Q12089225'), 'Malachite', '', 'Quartz;Feldspar;Mica;Calcite;Pyrite', min=6, **C),
    w('rocks', 'a type of rock', kinds('Q8063') + 'UNION ' + inst('Q11871901'), 'Pumice', '', 'Granite;Marble;Basalt;Limestone;Sandstone', min=2, **C),

    # Geography and places.
    w('volcanoes', 'a volcano', inst('Q8072', sub=True), 'Eyjafjallajökull', '', 'Mount Vesuvius;Mount St. Helens;Mount Fuji;Krakatoa;Mauna Loa', min=8),
    w('mountains', 'a mountain', inst('Q8502'), 'Table Mountain', '', 'Mount Everest;K2;Mount Kilimanjaro;Mont Blanc;Matterhorn', min=10),
    w('islands', 'an island', inst('Q23442'), 'Easter Island', '', 'Madagascar;Greenland;Bali;Sicily;Hawaii', min=20),
    w('lakes', 'a lake', inst('Q23397'), 'Lake Titicaca', '', 'Lake Superior;Lake Victoria;Lake Baikal;Lake Tahoe;Loch Ness', min=15),
    w('waterfalls', 'a waterfall', inst('Q34038', sub=True), 'Gullfoss', '', 'Niagara Falls;Victoria Falls;Angel Falls;Iguazu Falls;Yosemite Falls', min=5),
    w('national-parks', 'a national park', inst('Q46169'), 'Arches National Park', '', 'Yellowstone National Park;Yosemite National Park;Grand Canyon National Park;Banff National Park;Serengeti National Park', min=8),
    w('mountain-ranges', 'a mountain range', inst('Q46831'), 'Drakensberg', '', 'Himalayas;Andes;Rocky Mountains;Alps;Appalachian Mountains', min=10),
    w('bays', 'a bay or gulf', inst('Q39594', 'Q1322134'), 'Bay of Fundy', '', 'Gulf of Mexico;Bay of Bengal;Hudson Bay;Persian Gulf;San Francisco Bay', min=8),
    w('peninsulas', 'a peninsula', inst('Q34763'), 'Kamchatka Peninsula', '', 'Iberian Peninsula;Arabian Peninsula;Korean Peninsula;Scandinavian Peninsula;Balkan Peninsula', min=5),
    w('caves', 'a cave', inst('Q35509', sub=True), 'Blue Grotto', '', 'Mammoth Cave;Lascaux;Carlsbad Caverns National Park;Waitomo Glowworm Caves;Son Doong Cave', min=5),
    w('archipelagos', 'an archipelago or island group', inst('Q33837', 'Q1402592'), 'Svalbard', '', 'Galápagos Islands;Canary Islands;Hawaiian Islands;Azores;Maldives', min=8),
    w('castles', 'a castle', inst('Q23413', sub=True), 'Hearst Castle', '', 'Neuschwanstein Castle;Windsor Castle;Edinburgh Castle;Himeji Castle;Bran Castle', min=10),
    w('palaces', 'a palace', inst('Q16560', sub=True), 'Topkapı Palace', '', 'Buckingham Palace;Palace of Versailles;Forbidden City;Alhambra;Winter Palace', min=8),
    w('bridges', 'a bridge', inst('Q12280', sub=True), 'Ponte Vecchio', '', 'Golden Gate Bridge;Brooklyn Bridge;Tower Bridge;London Bridge;Sydney Harbour Bridge', min=8),
    w('skyscrapers', 'a skyscraper', inst('Q11303', sub=True), 'Flatiron Building', '', 'Burj Khalifa;Empire State Building;One World Trade Center;Willis Tower;Petronas Towers', min=5),
    w('museums', 'a museum', inst('Q33506', sub=True), 'Museum of Bad Art', '', 'Louvre;British Museum;Metropolitan Museum of Art;Museum of Modern Art;Smithsonian Institution', min=20),
    w('stadiums', 'a stadium or arena', inst('Q483110', 'Q641226', sub=True), 'Fenway Park', '', 'Wembley Stadium;Camp Nou;Madison Square Garden;Yankee Stadium;Maracanã Stadium', min=10),
    w('universities', 'a university', inst('Q3918', sub=True), 'University of Bologna', '', 'Harvard University;Massachusetts Institute of Technology;University of Oxford;University of Cambridge;Yale University', {'Massachusetts Institute of Technology': ['MIT']}, min=25),
    w('world-heritage', 'a UNESCO World Heritage Site', '?item wdt:P1435 wd:Q9259 .', 'Ha Long Bay', '', 'Great Wall of China;Machu Picchu;Taj Mahal;Petra;Stonehenge', min=5),
    w('former-countries', 'a country or empire that no longer exists', inst('Q3024240', 'Q48349'), 'Gran Colombia', '', 'Soviet Union;Roman Empire;Ottoman Empire;Yugoslavia;Prussia', {'Soviet Union': ['USSR']}, min=10),
    w('provinces', 'a state, province or region of any country', inst('Q10864048', sub=True), 'Tasmania', '', 'California;Texas;Ontario;Bavaria;Quebec', min=10),
    w('soccer-clubs', 'a soccer club', inst('Q476028'), 'Forest Green Rovers F.C.', '', 'Real Madrid Club de Fútbol;FC Barcelona;Manchester United F.C.;Liverpool F.C.;FC Bayern Munich', {'Real Madrid Club de Fútbol': ['Real Madrid'], 'Manchester United F.C.': ['Manchester United', 'Man United'], 'Liverpool F.C.': ['Liverpool'], 'FC Bayern Munich': ['Bayern Munich', 'Bayern']}, min=15),
    w('basketball-teams', 'a basketball team', inst('Q13393265'), 'Harlem Globetrotters', '', 'Los Angeles Lakers;Boston Celtics;Chicago Bulls;Golden State Warriors;Miami Heat', min=4),
    w('hockey-teams', 'an ice hockey team', inst('Q4498974'), 'Seattle Kraken', '', 'Toronto Maple Leafs;Montreal Canadiens;Boston Bruins;New York Rangers;Detroit Red Wings', min=4),
    w('baseball-teams', 'a baseball team', inst('Q13027888'), 'Savannah Bananas', '', 'New York Yankees;Boston Red Sox;Los Angeles Dodgers;Chicago Cubs;San Francisco Giants', min=2),
    w('football-teams', 'an American football team', inst('Q17156793'), 'Hamilton Tiger-Cats', '', 'Dallas Cowboys;New England Patriots;Green Bay Packers;Kansas City Chiefs;Pittsburgh Steelers', min=2),

    # Things, science and culture.
    w('dances', 'a dance', inst('Q11639', sub=True) + 'UNION ' + kinds('Q11639'), 'Lindy Hop', '', 'Waltz;Tango;Salsa;Ballet;Breakdancing', min=3, **C),
    w('martial-arts', 'a martial art', inst('Q11417', sub=True) + 'UNION ' + kinds('Q11417'), 'Capoeira', '', 'Karate;Judo;Taekwondo;Kung fu;Brazilian jiu-jitsu', min=2, **C),
    w('hairstyles', 'a hairstyle', inst('Q327496', sub=True) + 'UNION ' + kinds('Q327496'), 'Beehive', '', 'Ponytail;Bob cut;Mohawk;Mullet;Braid', min=1, **C),
    w('furniture', 'a piece of furniture', kinds('Q14745'), 'Ottoman', '', 'Chair;Table;Sofa;Bed;Desk', min=2, **C),
    w('vehicles', 'a type of vehicle', kinds('Q42889'), 'Hovercraft', '', 'Car;Bus;Bicycle;Truck;Motorcycle', min=5, **C),
    w('kitchen-tools', 'a kitchen utensil', kinds('Q3773693') + 'UNION ' + inst('Q3773693', sub=True), 'Mezzaluna', '', 'Spatula;Whisk;Ladle;Tongs;Peeler', min=1, **C),
    w('units', 'a unit of measurement', inst('Q47574', sub=True), 'Furlong', '', 'Metre;Kilogram;Second;Inch;Mile', {'Metre': ['meter']}, min=5, **C),
    w('currencies', 'a currency, past or present', inst('Q8142', sub=True), 'Doubloon', '', 'Euro;United States dollar;Japanese yen;Pound sterling;Swiss franc', {'United States dollar': ['dollar', 'US dollar']}, min=5),
    w('spacecraft', 'a spacecraft or space mission', inst('Q40218', sub=True), 'Sputnik 1', '', 'Apollo 11;International Space Station;Voyager 1;Hubble Space Telescope;Space Shuttle', min=10),

    # Extensions of existing prompts (rows appended to the reviewed corpora source).
    x('authors', occ('Q36180', 'Q6625963'), kind='person', min=25, cap=500, desc=r'writer|novelist|author|poet|playwright|essayist'),
    x('books', inst('Q7725634', 'Q8261', 'Q571'), min=15, cap=500),
    x('instruments', inst('Q34379', sub=True) + 'UNION ' + kinds('Q34379'), min=2, cap=500, common=True),
    x('flowers', taxon('Q25314', 40), kind='taxon', min=20, cap=500, common=True),
    x('cars', inst('Q786820', 'Q10429667'), min=5, cap=500),
    x('fruits', inst('Q3314483', sub=True) + 'UNION ' + kinds('Q3314483'), min=2, cap=500, common=True),
    x('cocktails', inst('Q134768', sub=True) + 'UNION ' + kinds('Q134768'), min=1, cap=500, common=True),
    x('clothing', kinds('Q11460'), min=2, cap=500, common=True),
    x('metals', inst('Q37756', sub=True) + 'UNION ' + kinds('Q37756'), min=2, cap=500, common=True),
    x('cats', inst('Q43577'), min=1, cap=400),
    x('rabbits', inst('Q12045584'), min=1, cap=400),
    x('condiments', inst('Q2596997', sub=True) + 'UNION ' + kinds('Q2596997'), min=1, cap=500, common=True),
    x('monsters', inst('Q2239243', sub=True), min=4, cap=500, fictional=True),
    x('newspapers', inst('Q11032', sub=True), min=10, cap=500),
    x('appliances', kinds('Q212920'), min=1, cap=500, common=True),
    x('rooms', kinds('Q180516'), min=1, cap=500, common=True),
    x('vegetables', inst('Q11004', sub=True) + 'UNION ' + kinds('Q11004'), min=1, cap=500, common=True),
    x('art', inst('Q968159', 'Q1792644'), min=4, cap=500),
    x('seas', inst('Q165', sub=True), min=4, cap=500),
    x('beer', inst('Q1998962', sub=True) + 'UNION ' + kinds('Q1998962'), min=1, cap=500, common=True),
    x('dinosaurs', taxon('Q430', 15, stop=['Q5113']), kind='taxon', min=8, cap=500, latin_ok=True),
    x('sandwiches', inst('Q28803', sub=True) + 'UNION ' + kinds('Q28803'), min=1, cap=500, common=True),
    x('sausages', inst('Q131419', sub=True) + 'UNION ' + kinds('Q131419'), min=1, cap=500, common=True),
    x('languages', '?item wdt:P220 ?code .', min=15, cap=500),
    x('rivers', inst('Q4022'), min=15, cap=500),
    x('board-games', inst('Q131436', sub=True), min=3, cap=500),
    x('companies', inst('Q4830453', 'Q891723', 'Q6881511'), min=40, cap=500),
    x('dogs', inst('Q39367'), min=1, cap=500),
    x('horses', inst('Q1160573'), min=1, cap=500),
    x('horror-movies', film('Q200092'), min=8, cap=500),
    x('thriller-movies', film('Q2484376'), min=8, cap=500),
    x('guitars', '?item wdt:P1056/wdt:P279* wd:Q6607 .', min=1, cap=500),
]

# Settlement rows appended to GeoNames-based city prompts (country QIDs for P17).
CITY_COUNTRIES = {'NZ': 'Q664', 'FI': 'Q33', 'SE': 'Q34', 'KE': 'Q114', 'GR': 'Q41', 'PE': 'Q419', 'CL': 'Q298',
                  'KR': 'Q884', 'PT': 'Q45', 'BE': 'Q31', 'EG': 'Q79', 'NL': 'Q55', 'IE': 'Q27', 'CH': 'Q39',
                  'AT': 'Q40', 'NO': 'Q20', 'CZ': 'Q213', 'HU': 'Q28', 'HR': 'Q224', 'MA': 'Q1028',
                  'MY': 'Q833', 'PK': 'Q843', 'RO': 'Q218'}
SPECS += [x(f'cities-{code.lower()}', settlements(country), min=4, cap=450) for code, country in CITY_COUNTRIES.items()]
