"""Editorial themes for the broad bank; clusters prevent neighboring near-duplicates."""

GROUPS = {
    'nature': 'animals dogs cats dinosaurs horses rabbits birds flowers plants toxic-plants winds weather meteorology mammals reptiles amphibians cattle chickens sheep goats',
    'food': 'seafood fruits vegetables spices cheeses sandwiches sausages apples tea condiments beer cocktails chefs restaurant-chains soft-drinks candy beer-brands italian-food french-food desserts cakes cookies breads soups pastries pasta salads noodles wine-grapes liqueurs',
    'everyday': 'first-names gemstones fabrics stones clothing rooms objects appliances colors crayons jobs cars companies newspapers industries charities agencies knots scents fashion-designers entrepreneurs youtubers toys car-models airlines airports retailers magazines banks motorcycles websites apps fonts hotel-chains hairstyles furniture vehicles kitchen-tools',
    'geography': 'countries capitals nationalities rivers seas landforms english-towns tube states us-capitals minerals rocks volcanoes mountains islands lakes waterfalls national-parks mountain-ranges bays peninsulas caves archipelagos castles palaces bridges skyscrapers museums stadiums universities world-heritage provinces',
    'words': 'languages',
    'science': 'scientists subjects elements metals constellations physicists chemists mathematicians astronauts inventors economists psychologists astronomers biologists computer-scientists nobel-laureates programming-languages operating-systems units currencies spacecraft fictional-materials',
    'history': 'philosophers explorers monarchs historians uk-parties former-countries greek-gods monsters greek-myth norse-myth',
    'books': 'authors books tolkien poets playwrights childrens-authors scifi-authors cartoonists literary-characters harry-potter scifi-books fantasy-books mystery-books classic-novels comic-strips manga comic-books fairy-tales',
    'film': 'british-actors movies directors american-actors animators oscar-actors films-classic films-1960s films-1970s films-1980s films-1990s films-2000s films-2010s films-2020s scifi-films fantasy-films animated-films romance-films westerns musical-films war-films crime-films superhero-films christmas-films teen-films spy-films martial-arts-films biopics romcoms mystery-films adventure-films disney-films bollywood japanese-films french-films comedy-movies horror-movies action-movies drama-movies thriller-movies superheroes marvel dc',
    'tv': 'tv comedians tv-hosts simpsons cartoon-characters anime-characters sitcoms animated-series reality-tv game-shows soap-operas anime british-tv netflix hbo kids-tv k-dramas tv-channels',
    'music': 'music-genres instruments rock-hall guitars composers singers rappers guitarists drummers pianists jazz opera-singers country-singers djs violinists conductors albums songs ballets rock-bands metal-bands boy-bands girl-groups kpop music-festivals record-labels',
    'sports': 'sports wrestling soccer-players basketball-players baseball-players nfl-players tennis-players golfers boxers f1-drivers hockey-players cricketers chess-players swimmers track-athletes figure-skaters cyclists skiers gymnasts pro-wrestlers mma-fighters rugby-players mountaineers ballet-dancers dances martial-arts soccer-clubs basketball-teams hockey-teams baseball-teams football-teams',
    'games': 'board-games pokemon game-characters video-games nintendo-games game-series card-games game-studios magicians',
    'art': 'art painters architects sculptors photographers sculptures',
}
THEMES = {id: theme for theme, ids in GROUPS.items() for id in ids.split()}
JAPAN = {'manga', 'anime', 'anime-characters', 'japanese-films', 'cities-jp'}


def tag(prompt):
    id = prompt['id']
    prompt['theme'] = 'geography' if id.startswith('cities-') else THEMES[id]
    cluster = None
    if id in JAPAN:
        cluster = 'japan'
    elif id.startswith('cities-'):
        cluster = 'cities'
    elif id == 'pokemon':
        cluster = 'pokemon'
    elif id in {'countries', 'nationalities', 'former-countries'}:
        cluster = 'countries'
    elif id in {'capitals', 'us-capitals'}:
        cluster = 'capitals'
    elif id == 'states':
        cluster = 'us-states'
    elif id in {'elements', 'metals'}:
        cluster = 'elements'
    elif id == 'nobel-laureates':
        cluster = 'nobel'
    elif id == 'oscar-actors':
        cluster = 'oscars'
    prompt['cluster'] = cluster
