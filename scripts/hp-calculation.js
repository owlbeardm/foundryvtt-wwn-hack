#!/bin/node

const ITERATIONS = 1000;
const LEVELS = 5;

const classes = 
    [{
        name: "Warrior",
        hitDice: {
            random: 6,
            bonus: 2
        }

    },{
        name: "Expert",
        hitDice: {
            random: 6,
            bonus: 0
        }
    },{
        name: "Mage",
        hitDice: {
            random: 6,
            bonus: -1
        }

    }];

const calculateHp = (level, htDice, con) => {
    let hp = 0;
    for(let l = 0; l<level; l++) {
        hp += Math.random() * htDice.random;
        hp = Math.ceil(hp) +  htDice.bonus + con;
    }
    return Math.max(1,hp);
}

const printLevel = (level) => {
    logItalic (`LEVEL #${level}`);
}

classes.forEach((clazz) => {
    console.log(`${clazz.name.toUpperCase()}:`);
    for(let l = 1; l <= LEVELS; l++) {
        printLevel(l);
        let variants = 0;
        let hp = 0;
        for(let str = -2; str <= 2; str ++) {
            for (let dex = -2; dex <= 2; dex ++) {
                for(let con = -2; con <= 2; con++) {
                    for(let it = 0; it < ITERATIONS; it++) {
                        variants += 1;
                        hp += calculateHp(l, clazz.hitDice, con);
                    }
                }
            }
        }
        console.log(`    avarage HP ${Math.ceil(hp/variants)}`);
        console.log(`    avarage ${''} hits from ${''}`);
    }
});
function logBold(...arguments) {
  if (typeof(console) !== 'undefined') {
//    arguments.unshift("\x1b[1m");
    arguments.unshift("\x1b[31m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logItalic(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[3m");
    arguments.unshift("\x1b[34m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logError(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[31m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logSuccess(...arguments) {
  if (typeof(console) !== 'undefined') {
    arguments.unshift("\x1b[32m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

// Warrior 
//   level
//   mean hp (-2,-1,0,1,2)
//   dex (-2,-1,0,1,2)
//   str (-2,-1,0,1,2)
//   armor (non, light, medium, heavy)
//   shield (none, light, heavy)
//   armor skill (-1,0,1,2,3,4)
