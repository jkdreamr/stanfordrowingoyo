const subjects = [
  `a part of a rowing shell
a tool in a boat repair kit
a piece of clothing worn at a regatta
a sound heard at a race start
a reason a crew might stop rowing
a place to keep an oar
a word a coxswain might shout
a color for a new racing shell
a thing floating beside a dock
a way to carry a water bottle in a boat
a task before launching a shell
a reason to adjust a foot stretcher
a thing found in a coxswain's bag
a part of an oar
a landmark a crew could steer toward
a thing you wipe off after rowing
a problem a rigger can have
a kind of boat besides a rowing shell
a person who helps run a regatta
a thing tied to a dock
a word describing a good catch
a reason a seat might feel uncomfortable
a place a missing spacer could hide
a thing a launch driver carries
a way to mark a finish line
a reason to change a lineup
a thing you check on a trailer
a material used to build a boat
a thing that rattles in a boathouse
a place you would put a boat's name`,
  `a workout you can do without equipment
a song you would erg to
a snack after a long row
a stretch for tired legs
a thing on an erg monitor
a reason to slow down on a run
a place to do hill sprints
a thing you count during intervals
a way to cool down after practice
a sport that helps your balance
a muscle sore after rowing
a thing in a gym bag
a workout you would do on vacation
a number you notice on a bike ride
a way to stay warm before racing
a reason to take a rest day
a thing you do between sets
a drink after a hot workout
a place to leave sweaty shoes
a reward for finishing an early workout
a thing you hear in a weight room
a reason to use a foam roller
a distance you might race on foot
a way to make an easy run interesting
a thing to bring on a long bike ride
a surface you might run on
a piece of exercise equipment with a handle
a thing a training partner can remind you of
a type of exercise done lying down
a way to pass time during a long warmup`,
  `a Stanford campus landmark
a place to study near the Main Quad
a thing seen from Hoover Tower
a food you might find at a campus cafe
a thing to bring to a Stanford lecture
a way to cross campus when late
a place to meet a friend on campus
a thing you might see at the Oval
a subject you could take at Stanford
a thing sold at a university bookstore
a spot to read outdoors on campus
a sound heard near a campus fountain
a thing you could lose on Palm Drive
a reason to visit the Stanford library
a thing to do before a campus exam
a campus event that needs a microphone
a thing you would put on a dorm wall
a place to eat between classes
a thing that fits in a bike basket
a color you see in a Stanford stadium
a thing growing near a campus path
a reason to visit a professor's office
a thing to borrow from a classmate
a place to escape the rain on campus
a thing on a university bulletin board
a campus building you would show a visitor
a thing you might hear at a graduation
a dorm room item you would share
a thing you would photograph on campus
a reason to stay on campus over a weekend`,
  `a Bay Area city
a food to eat in San Francisco
a place to watch a Bay Area sunset
a thing you might see on Caltrain
a reason to cross the Golden Gate Bridge
a thing to bring to Ocean Beach
a place to hike on the Peninsula
a thing you see near a salt pond
a sound heard on a foggy waterfront
a place to buy fruit in the Bay Area
a thing you might spot in the Bay water
a way to get to San Jose
a thing you would find at a farmers market
a place to take a visitor in Oakland
a reason to visit Half Moon Bay
a thing you notice from a ferry
a food to pack for a redwood hike
a thing you might see at a tide pool
a place to ride a bike near Palo Alto
a thing you would take to a Giants game
a reason a Bay Area bridge closes
a place to get warm on a foggy day
a thing you find at a California beach
a kind of bird near San Francisco Bay
a thing you might see from Highway 1
a town you could visit north of San Francisco
a reason to take BART
a thing you might photograph in Chinatown
a place to stop on a trip to Santa Cruz
a thing associated with Silicon Valley`,
  `a nickname for a very fast boat
a thing a teammate always forgets
a topic for a team road trip debate
a game for a team bus ride
a dish to bring to a team dinner
a way to celebrate a teammate's birthday
a thing a team captain organizes
a reason to thank a teammate
a team chore nobody volunteers for
a thing passed around on a team trip
a prize you could invent for best teammate
a phrase for a team group chat name
a thing to bring to a team picnic
a sound a bus full of athletes makes
a thing to sign at the end of a season
a place for a team photo
a job for the first person at practice
a thing you would put in a team time capsule
a way to welcome a new teammate
a team tradition you could start
a thing a teammate might borrow
a topic to avoid during a tough workout
a way to cheer without shouting
a thing to leave in a teammate's locker
a costume for a team theme day
a skill you could teach a teammate
a thing you might put on a team banner
a reason a team dinner runs late
a thing to pack for an away race
a way to pick teams without arguing`,
  `a pizza topping that is not cheese
a breakfast food you can hold
a fruit with a peel
a vegetable you can roast
a food you eat with chopsticks
a dish that tastes better the next day
a sandwich filling that is not meat
a soup you would eat in winter
a dessert served cold
a food shaped like a ring
a spice used in baking
a food that stains your fingers
a topping for oatmeal
a food you can cook on a campfire
a kind of noodle
a condiment kept in a refrigerator
a food you would bring to a potluck
a drink served with ice
a food that makes a loud crunch
a green food that is not a vegetable
a food wrapped in a leaf
a filling for a dumpling
a food you eat from a bowl
a flavor for a birthday cake
a snack you would find at a gas station
a food that comes in layers
a food you would dip in chocolate
a food with a surprising texture
a meal you can make in one pan
a food you associate with summer`,
  `an animal with stripes
an animal that lives in a river
an animal smaller than your hand
an animal that travels in a group
an animal that sleeps during the day
an animal with a long tail
an animal that builds a home
an animal you might see on a farm
an animal with a shell
an animal that makes a loud noise
an animal that can climb a tree
an animal with an unusual nose
an animal that lives in the desert
an animal that changes color
an animal that eats insects
an animal that swims but is not a fish
an animal you might find in a garden
an animal with horns
an animal known for moving slowly
an animal with spots
an animal that migrates
an animal that could fit in a backpack
an animal with a funny walk
an animal that digs underground
an animal you would not want in your kitchen
an animal found in cold places
an animal with a very short name
an animal known for jumping
an animal with bright feathers
an animal that can survive in a city`,
  `a thing in a junk drawer
a thing that uses a tiny battery
a thing you can fold flat
a thing with a lid
a thing you can hang on a hook
a thing made of glass
a thing with a zipper
a thing you can balance on one finger
a thing that squeaks
a thing that comes in a pair
a thing you could use as a bookmark
a thing with wheels smaller than your hand
a thing that glows without a screen
a thing that sticks to a magnet
a thing you could stack ten high
a thing you can wind up
a thing made of rubber
a thing you can use as a paperweight
a thing you might find behind a couch
a thing with a broken handle
a thing you can sharpen
a thing sold in a hardware store
a thing that rolls away easily
a thing that makes a good doorstop
a thing you can tie in a knot
a thing with a spring inside
a thing you use to measure length
a thing that melts in the sun
a thing that fits in a wallet
a thing you can reuse as a plant pot`,
  `a movie set mostly at sea
a fictional character who wears a hat
a board game with dice
a musical instrument with strings
a song with a place in its title
a fictional creature with wings
a movie snack besides popcorn
a video game that involves building
a book you would lend a friend
a dance move you know by name
a character who lives in a castle
a sport played on ice
a television show with a team
a thing a magician pulls from a hat
a game you can play with a pencil
a movie character with a pet
a type of live performance
a song you would sing in a car
a game played with a ball and no net
a fictional place you would visit
a costume that needs a cape
a musical instrument you can carry
a type of puzzle
a thing you see on a theater stage
a hobby that uses paint
a story with a journey in it
a game that can end in a tie
a character known for wearing red
a thing in an arcade
a reason to give a standing ovation`,
  `a place with a long line
a room that usually has no windows
a place that smells like fresh bread
a place you would whisper
a place that needs a ticket
a place where you take off your shoes
a place with a public clock
a place you can rent something
a place you might hear an echo
a place with numbered seats
a place you would visit at sunrise
a place with a safety railing
a place that keeps things cold
a place you could buy a map
a place with a dress code
a place where you wait for a friend
a place you would bring binoculars
a place you would see a uniform
a place with more chairs than people
a place to watch the rain
a place you might see a fountain
a place with a spiral staircase
a place where you cannot use a phone
a place you could find an old photograph
a place that closes for the winter
a place with a big door
a place to hide from the wind
a place that is open all night
a place with a bell
a place that feels smaller as an adult`,
  `a tree with edible fruit
a flower you know by name
a thing you see after heavy rain
a type of cloud
a thing you find under a rock
a natural thing shaped like a spiral
a smell you associate with spring
a thing that washes up on shore
a plant that needs little water
a thing that sparkles in nature
a reason a trail might close
a thing you see in a clear night sky
a sound you hear in a forest
a thing that floats in a pond
a plant with a strong smell
a natural thing you could collect
a sign that autumn has arrived
a thing you notice before a storm
a rock you know by name
a thing growing on a fallen log
a kind of freshwater fish
a reason a river might change color
a thing you would sketch in a park
a natural thing that is purple
a thing you might find in a cave
a plant with thorns
a sign that an animal passed by
a thing you see on a mountain peak
a natural thing that feels soft
a reason to stop on a nature walk`,
  `a thing you pack but never use
a thing you can buy at an airport
a country with a coastline
a way to travel without a motor
a thing you would see from a train
a souvenir that fits in a pocket
a reason to miss a flight
a thing you need on a camping trip
a city you would visit for its food
a thing you might forget in a hotel room
a thing on a road sign
a reason to take the scenic route
a thing you would do on a rainy vacation
a bag you might take on a weekend trip
a thing that makes a long drive better
a place to refill a water bottle while traveling
a thing you might ask a tour guide
a reason to travel by boat
a thing you would bring on a snowy trip
a place you could sleep on a journey
a thing you can do without speaking the local language
a thing you would photograph on a train ride
a reason to visit an island
a thing you would find at a rest stop
a thing that belongs on a luggage tag
a landmark built before you were born
a thing you would pack for a desert trip
a mode of transportation with a schedule
a reason to go back to the same vacation spot
a thing that makes a good travel pillow`,
  `a superpower useful for doing laundry
a job for a friendly robot
a thing a dragon might hoard besides gold
a name for a boat on the moon
a subject at a school for ghosts
a snack for a giant
a sound a tiny spaceship could make
a thing you would ask a talking tree
a sport that would be funny underwater
a thing you would put in a time machine
a pet for a wizard
a rule for a city made of trampolines
a thing a snowman might be afraid of
a gift for someone who has everything
a place to hide a very small treasure
a thing you would invent for early mornings
a reason an alien might visit a grocery store
a job that would be easier with four arms
a thing you would build out of marshmallows
a tool for exploring a cloud
a thing you would put in a museum of mistakes
a flavor for a fictional fruit
a vehicle for a garden gnome
a thing to bring to a party on Mars
a secret entrance to a treehouse
a thing a pirate might collect besides treasure
a name for a team of penguins
a reason a superhero might be late
a thing you would teach a talking dog
a prize for winning a contest of patience`,
  `a thing you do before breakfast
a chore you can finish in five minutes
a thing you check before leaving home
a reason to set an alarm
a thing you keep beside your bed
a way to remember a name
a thing you might write on a sticky note
a reason to knock on a neighbor's door
a thing you look for when the power goes out
a small kindness you can do for a stranger
a thing you might spill on a shirt
a reason to open a window
a thing you would fix with tape
a thing you do while waiting for a kettle
a sound that wakes you up
a reason to carry a spare key
a thing you might leave on a doorstep
a way to make a room smell better
a thing you save for a rainy day
a habit that makes mornings easier
a thing you do with an empty box
a reason to write a thank you note
a thing you keep in a coat pocket
a way to spend ten minutes outdoors
a thing you would clean with a brush
a reason to turn your phone off
a thing that makes you lose track of time
a thing you would like to learn this year
a way to make a friend laugh
a thing that makes a house feel like home`,
];

export const DIVE_PROMPTS = subjects.flatMap((group) =>
  group.split('\n').map((subject) => `Name ${subject}.`),
);

function permutation() {
  const result = [...DIVE_PROMPTS];
  let state = 0x6f796f;
  function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const ordered = permutation();
export function divePromptsFor(date: string): string[] {
  const day = Math.floor(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse('2026-01-01T12:00:00Z')) / 86400000,
  );
  return Array.from(
    { length: 7 },
    (_, i) => ordered[(((day * 7 + i) % ordered.length) + ordered.length) % ordered.length],
  );
}
