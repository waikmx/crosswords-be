// noinspection JSUnusedLocalSymbols

import {CanvasManager} from "./manager"
import {range} from "../helper/utils";


let sample = [
    // "afectuosamente", "circunferencia", "contradictorio", "descubrimiento", "extraordinario", "extraterrestre",
    // "revolucionario", "verdaderamente", "vulnerabilidad", "calentamiento", "circunstancia", "confrontación",
    // "decepcionante", "efectivamente", "especializado", "impresionante", "independiente", "justificación", "perseverancia",
    // "planificación", "aproximación", "comprensible", "condenatorio", "confidencial", "consecuencia", "convencional",
    "cuestionable", "desagradable", "especialista", "estacionario", "humildemente", "impredecible", "investigador",
    // "manipulación", "posiblemente", "proporcionar", "recopilación", "sorprendente", "transparente",
    // "comprensión",
    "comprometer", "desesperado", "diferenciar", "equivalente", "experimento", "generosidad", "ilustración", "interacción",
    // "interactuar", "interpretar", "provisional", "representar", "responsable", "simplificar", "aceptación", "afirmativo",
    // "afortunado", "celebridad", "comestible", "compromiso", "comunicado", "consciente", "contribuir", "desarrollo",
    // "disciplina", "enfermedad", "establecer", "explorador", "industrial", "inevitable", "inflexible", "insensible",
    // "inspección", "introducir", "observador", "participar", "periodista", "perseverar", "predecible", "preocupado",
    "abeja", "abeto", "agua", "agudo", "aguja", "al gusto", "ala", "alcachofas", "altavoz", "amistad", "argumento",
    "arrugado", "asombroso", "atún", "audífonos", "azul", "bacon", "balón", "barco", "blanco", "boca", "bocina",
    "brillo", "bruma", "caballo", "caja", "cala", "calabacin", "cama", "camino", "caracol", "casa", "casco",
    "catalana", "cañería", "cañón", "cebolla", "ceja", "chata", "chirrido", "cielo", "claras", "colaborar",
    "convencer", "cubo", "cuello", "curva", "círculo", "cóncavo", "dado", "dedo", "delicioso", "dirigir", "dura",
    "ejecución", "ejes", "ensordecedor", "esfera", "español", "espinacas", "facilitar", "figura", "flor", "fosa nasal",
    "francesa", "fruta", "fórmula", "gambas", "gato", "gota", "graso", "grave", "guisantes", "guitarra", "hacha",
    "hermoso", "hoja", "huevo", "inmediato", "labio", "lado", "lago", "lana", "libro", "llave", "lluvia", "lobo",
    "luna", "luz", "lápiz", "mango", "mar", "mejilas", "mencionar", "mesa", "mofletes", "murmullo", "naranja",
    "nariz", "nieve", "niño", "noche", "nube", "nuez", "obtuso", "octaedro", "ojo", "omelettes", "oro", "paisana",
    "palma", "pan", "papel", "patatas", "pato", "pelo", "pentágono", "peregrino", "perro", "perímetro",
    "pico de viuda", "pico", "pie", "piel", "plato", "playa", "puente", "puerta", "pulgar", "pulso", "puntiaguda",
    "queso", "radio", "rana", "ratón", "rayo", "reina", "reloj", "resplandor", "risa", "rojo", "rosa", "rostro",
    "rueda", "ruido", "río", "salsa", "secretario", "shakshuka", "silbar", "silencio", "silla", "sinceridad", "sol",
    "soltar", "sombra", "sonar", "sordera", "sordo", "taza", "tecnología", "tiburón", "tierra", "tigre", "traducción",
    "traje", "tren", "trenzas", "triángulo", "uva", "uña", "verde", "viento", "vino", "volumen", "voluntario", "voz",
    "vértice", "yunque", "área", "ñañaras"
]

let tortillas = [
    "francesa", "atún", "claras", "guisantes", "gambas", "salsa", "bacon", "shakshuka", "cebolla", "calabacin",
    "catalana", "al gusto", "patatas", "omelettes", "espinacas", "paisana", "huevo", "alcachofas"
]

let peloYCara = [
    "boca", "cuello", "piel", "trenzas", "puntiaguda", "hermoso", "labio", "ceja", "mofletes",
    "graso", "pico de viuda", "rostro", "mejilas", "nariz", "dura", "arrugado", "fosa nasal",
    "chata"
]

let relativoAlOido = [
    "agudo", "yunque", "sordera", "ensordecedor", "altavoz", "silbar", "voz", "grave", "audífonos",
    "murmullo", "chirrido", "sordo", "bocina", "ruido", "casco", "sonar", "silencio"
]

let geometria = [
    "cubo", "pentágono", "lado", "ejes", "círculo", "perímetro", "figura", "cóncavo", "fórmula",
    "octaedro", "volumen", "radio", "obtuso", "área", "triángulo", "esfera", "vértice", "curva"
]

let _6small: string[] = ["hoja", "lago", "lana", "lobo", "luna", "mesa"]
let _6big: string[] = ["inspección", "introducir", "observador", "participar", "periodista", "perseverar"]
let _6mixed: string[] = ["inspección", "introducir", "observador", "hoja", "lago", "lana"]
let _6med1: string[] = ["sordera", "ensordecedor", "altavoz", "silbar", "voz", "grave"]
let _6med2: string[] = ["graso", "pico de viuda", "rostro", "mejilas", "nariz"]

let paises = ["FRANCIA", "ESTADOS UNIDOS", "ALEMANIA", "CANADA", "PERU", "VENEZUELA", "ESPAÑA", "ROSARIO", "BRASIL", "JAPON", "CUBA", "PANAMA", "MEXICO", "PARAGUAY", "CHINA", "EL SALVADOR", "ECUADOR", "HAITI"]

let failingSample = [
    'HOT',
    'DRY',
    'SUN',
    'FOX',
    'SAND',
    'ARID',
    'GOBI',
    'CAMEL',
    'DINGO',
    'DUNES',
    'OASIS',
    'SNAKE',
    'SINAI',
    'CACTUS',
    'COYOTE',
    'BEETLE',
    'SAHARA',
    'MIRAGE',
    'TUAREG',
    'ATACAMA',
    'ARABIAN',
    'VULTURE',
    'SIROCCO',
    'PRICKLY',
    'DROUGHT',
    'ALMERIA',
    'BUZZARD',
    'BEDOUIN',
    'SCORPION',
    'KALAHARI',
    'PALM TREE',
    'PATAGONIA',
    'CHIHUAHUA',
    'ROADRUNNER',
    'RATTLESNAKE'
]

/*
let matrix = new CanvasManager(paises,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(paises)


let matrix = new CanvasManager(_6small,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(_6small)

matrix = new CanvasManager(_6big,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(_6big)

matrix = new CanvasManager(_6mixed,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(_6mixed)

matrix = new CanvasManager(_6med1,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(_6med1)

matrix = new CanvasManager(_6med2,)
matrix.addWordsStrategic()
console.log(matrix.string)
console.log(_6med2)

 */

let gameSample = [
    "AFTERSHAVE,.$%", "ALBORNOZ,.$%", "BAÑERA,.$%", "BIDÉ,.$%",// "ALFOMBRILLA", "ANTICASPA", "ARMARIO",
    // "CADENA", "CHAMPÚ", "CISTERNA", "DENTÍFRICO", "DESODORANTE",
    "COLONIA,.$%", "CORTINA,.$%", "DUCHA,.$%", // "ESPEJO", "GEL DE BAÑO", "GRIFO",
    "HILO,.$%", "INODORO,.$%", "JABÓN,.$%",
    "LACA,.$%", "LAVABO,.$%", "LOCIÓN,.$%", "PEINE,.$%", "TOALLA,.$%", // "SEDA DENTAL",
    "TAPÓN,.$%", "TINA,.$%", "VÁTER,.$%" // ,"TOALLERO",
]

for ({} of range(0, 1))
    for (let size of [12]) {
        console.log(`Matrix for ${size} words`)
        let matrix = new CanvasManager(
            gameSample,
            size
        )
        if (matrix.addWordsStrategic()) {
            console.log(matrix.debugString)
            console.log(matrix.inserted)
            console.log(matrix.complete)
        } else console.log("Failed to generate crossword")

    }
