const fs = require('fs');
const path = require('path');

function ex(key, name, pattern, muscleGroup, type, equipment, extra) {
  const more = extra || {};
  return {
    key,
    name,
    pattern,
    muscleGroup,
    primary: more.primary || [muscleGroup],
    secondary: more.secondary || [],
    type,
    equipment,
    difficulty: more.difficulty == null ? 1 : more.difficulty,
    fatigue: more.fatigue == null ? (type === 'compound' ? 2 : 1) : more.fatigue,
    avoidIf: more.avoidIf || [],
    emphasis: more.emphasis || [],
    tip: more.tip || '',
    linkLabel: '▶ Buscar técnica en YouTube',
  };
}

const F = ['full_gym', 'basic_gym', 'home_dumbbells', 'bodyweight'];
const G = ['full_gym'];
const B = ['full_gym', 'basic_gym'];
const H = ['full_gym', 'basic_gym', 'home_dumbbells'];
const W = ['bodyweight'];
const HD = ['home_dumbbells'];
const FG = ['full_gym', 'basic_gym', 'home_dumbbells'];

const list = [
  ex('back_squat', 'Sentadilla con barra', 'squat', 'Piernas', 'compound', B, { difficulty: 3, fatigue: 3, avoidIf: ['knee', 'lower_back'], emphasis: ['quads'], tip: 'Pies al ancho de hombros. Bajá hasta que la cadera pase la rodilla, si tu movilidad lo permite.' }),
  ex('goblet_squat', 'Sentadilla goblet', 'squat', 'Piernas', 'compound', H, { difficulty: 1, fatigue: 2, emphasis: ['quads'], tip: 'La mancuerna pegada al pecho. Codos apuntan al piso.' }),
  ex('leg_press', 'Prensa de piernas', 'squat', 'Piernas', 'compound', G, { difficulty: 1, fatigue: 2, avoidIf: ['knee'], tip: 'Bajá sin despegar la zona lumbar del respaldo.' }),
  ex('hack_squat', 'Hack squat', 'squat', 'Piernas', 'compound', G, { difficulty: 2, fatigue: 2, avoidIf: ['knee'] }),
  ex('air_squat', 'Sentadilla al aire', 'squat', 'Piernas', 'compound', W, { difficulty: 1, fatigue: 1, tip: 'Talones apoyados. Rodillas siguen la punta de los pies.' }),
  ex('db_rdl', 'Peso muerto rumano con mancuernas', 'hinge', 'Piernas', 'compound', H, { difficulty: 1, fatigue: 2, emphasis: ['hamstrings'], tip: 'Cadera atrás, espalda neutra. Bajá hasta sentir el isquio.' }),
  ex('barbell_rdl', 'Peso muerto rumano con barra', 'hinge', 'Piernas', 'compound', B, { difficulty: 2, fatigue: 3, avoidIf: ['lower_back'], emphasis: ['hamstrings'] }),
  ex('conv_deadlift', 'Peso muerto convencional', 'hinge', 'Piernas', 'compound', B, { difficulty: 3, fatigue: 3, avoidIf: ['lower_back'], tip: 'La barra pegada a las tibias. Empujá el piso.' }),
  ex('hip_hinge', 'Bisagra de cadera', 'hinge', 'Glúteos', 'compound', W, { difficulty: 1, fatigue: 1, emphasis: ['glutes'] }),
  ex('hip_thrust', 'Hip thrust', 'hinge', 'Glúteos', 'compound', H, { difficulty: 1, fatigue: 2, emphasis: ['glutes'], tip: 'Mentón metido. Apretá glúteos arriba, sin arquear la lumbar.' }),
  ex('back_extension', 'Extensión de espalda', 'hinge', 'Piernas', 'compound', G, { difficulty: 1, fatigue: 1, avoidIf: ['lower_back'] }),
  ex('walking_lunge', 'Zancadas', 'lunge', 'Piernas', 'compound', F, { difficulty: 1, fatigue: 2, avoidIf: ['knee'], tip: 'Paso largo. La rodilla de atrás baja hacia el piso.' }),
  ex('bulgarian', 'Sentadilla búlgara', 'lunge', 'Piernas', 'compound', H, { difficulty: 2, fatigue: 2, avoidIf: ['knee'], emphasis: ['quads', 'glutes'] }),
  ex('step_up', 'Step-ups', 'lunge', 'Piernas', 'compound', H, { difficulty: 1, fatigue: 2, avoidIf: ['knee'] }),
  ex('reverse_lunge', 'Zancada hacia atrás', 'lunge', 'Piernas', 'compound', W, { difficulty: 1, fatigue: 1 }),
  ex('split_squat', 'Sentadilla split', 'lunge', 'Piernas', 'compound', F, { difficulty: 1, fatigue: 2, emphasis: ['glutes'] }),
  ex('bench_press', 'Press de banca', 'horizontal_push', 'Pecho', 'compound', B, { difficulty: 2, fatigue: 2, secondary: ['Tríceps', 'Deltoides anterior'], tip: 'Escápulas atrás y abajo. Bajá la barra al pecho medio.' }),
  ex('db_bench', 'Press plano con mancuernas', 'horizontal_push', 'Pecho', 'compound', H, { difficulty: 1, fatigue: 2, secondary: ['Tríceps'] }),
  ex('machine_chest', 'Press de pecho en máquina', 'horizontal_push', 'Pecho', 'compound', G, { difficulty: 1, fatigue: 2 }),
  ex('pushup', 'Flexiones', 'horizontal_push', 'Pecho', 'compound', W, { difficulty: 1, fatigue: 1, tip: 'Cuerpo en bloque. Pecho casi toca el piso.' }),
  ex('wide_chest', 'Wide Chest Press', 'horizontal_push', 'Pecho', 'compound', G, { difficulty: 1, fatigue: 2, emphasis: ['chest'] }),
  ex('incline_db', 'Press inclinado con mancuernas', 'incline_push', 'Pecho', 'compound', H, { difficulty: 1, fatigue: 2, emphasis: ['upper_chest'], secondary: ['Deltoides anterior', 'Tríceps'], tip: 'Banco a 30°. Bajá controlado hasta sentir estiramiento.' }),
  ex('incline_bar', 'Press inclinado con barra', 'incline_push', 'Pecho', 'compound', B, { difficulty: 2, fatigue: 2, emphasis: ['upper_chest'], avoidIf: ['shoulder'] }),
  ex('hs_incline', 'Hammer Strength Iso-Lateral Incline Press', 'incline_push', 'Pecho', 'compound', G, { difficulty: 1, fatigue: 2, emphasis: ['upper_chest'] }),
  ex('incline_pushup', 'Flexiones inclinadas', 'incline_push', 'Pecho', 'compound', W, { difficulty: 1, fatigue: 1, emphasis: ['upper_chest'], tip: 'Manos en un banco. El cuerpo baja derecho.' }),
  ex('ohp_bar', 'Press militar con barra', 'vertical_push', 'Hombros', 'compound', B, { difficulty: 3, fatigue: 2, avoidIf: ['shoulder', 'lower_back'], emphasis: ['side_delts'] }),
  ex('ohp_db', 'Press militar con mancuernas', 'vertical_push', 'Hombros', 'compound', H, { difficulty: 2, fatigue: 2, avoidIf: ['shoulder'] }),
  ex('machine_shoulder', 'Press de hombros en máquina', 'vertical_push', 'Hombros', 'compound', G, { difficulty: 1, fatigue: 2 }),
  ex('neutral_ohp', 'Press de hombros neutro', 'vertical_push', 'Hombros', 'compound', H, { difficulty: 1, fatigue: 2, tip: 'Mancuernas con las palmas enfrentadas. Subí sin arquear la espalda.' }),
  ex('pike_pushup', 'Flexiones pike', 'vertical_push', 'Hombros', 'compound', W, { difficulty: 2, fatigue: 1, avoidIf: ['shoulder', 'wrist'] }),
  ex('wall_slide', 'Deslizamientos en la pared', 'vertical_push', 'Hombros', 'compound', W, { difficulty: 1, fatigue: 1, tip: 'Espalda y brazos contra la pared. Subí sin despegar las costillas.' }),
  ex('db_row', 'Remo con mancuerna', 'horizontal_pull', 'Espalda', 'compound', H, { difficulty: 1, fatigue: 2, emphasis: ['lats'], tip: 'Llevá el codo hacia la cadera, sin girar el torso.' }),
  ex('barbell_row', 'Remo con barra', 'horizontal_pull', 'Espalda', 'compound', B, { difficulty: 2, fatigue: 3, avoidIf: ['lower_back'], emphasis: ['lats'] }),
  ex('cable_row', 'Remo en cable', 'horizontal_pull', 'Espalda', 'compound', B, { difficulty: 1, fatigue: 2, emphasis: ['lats'] }),
  ex('seal_row', 'Remo en máquina', 'horizontal_pull', 'Espalda', 'compound', G, { difficulty: 1, fatigue: 2 }),
  ex('inverted_row', 'Remo invertido', 'horizontal_pull', 'Espalda', 'compound', W, { difficulty: 1, fatigue: 1, tip: 'Cuerpo derecho debajo de una mesa firme. Llevá el pecho a la barra.' }),
  ex('lat_pulldown', 'Jalón al pecho', 'vertical_pull', 'Espalda', 'compound', B, { difficulty: 1, fatigue: 2, emphasis: ['lats'], tip: 'Pecho arriba. Llevá la barra al pecho, sin tirar con los bíceps solos.' }),
  ex('pullup', 'Dominadas', 'vertical_pull', 'Espalda', 'compound', ['full_gym', 'basic_gym', 'bodyweight'], { difficulty: 3, fatigue: 2, emphasis: ['lats'] }),
  ex('assisted_pullup', 'Dominadas asistidas', 'vertical_pull', 'Espalda', 'compound', G, { difficulty: 1, fatigue: 2, emphasis: ['lats'] }),
  ex('supine_pulldown', 'Jalón supino', 'vertical_pull', 'Espalda', 'compound', B, { difficulty: 1, fatigue: 2, secondary: ['Bíceps'] }),
  ex('door_pull', 'Jalón en marco de puerta', 'vertical_pull', 'Espalda', 'compound', W, { difficulty: 1, fatigue: 1, tip: 'Afirmate del marco y llevá el pecho hacia las manos.' }),
  ex('db_pulldown', 'Jalón a un brazo con mancuerna', 'vertical_pull', 'Espalda', 'compound', HD, { difficulty: 1, fatigue: 1, emphasis: ['lats'], tip: 'Tronco apenas inclinado. Llevá el codo hacia el bolsillo.' }),
  ex('pec_fly', 'Life Fitness Pectoral Fly', 'chest_fly', 'Pecho', 'isolation', G, { difficulty: 1, fatigue: 1, emphasis: ['chest'] }),
  ex('db_fly', 'Aperturas con mancuernas', 'chest_fly', 'Pecho', 'isolation', H, { difficulty: 1, fatigue: 1, avoidIf: ['shoulder'] }),
  ex('floor_db_fly', 'Aperturas en el piso con mancuernas', 'chest_fly', 'Pecho', 'isolation', HD, { difficulty: 1, fatigue: 1 }),
  ex('cable_fly', 'Aperturas en polea', 'chest_fly', 'Pecho', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('floor_fly', 'Aperturas en el piso', 'chest_fly', 'Pecho', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('lat_raise_db', 'Elevaciones laterales con mancuerna', 'lateral_raise', 'Hombros', 'isolation', H, { difficulty: 1, fatigue: 1, emphasis: ['side_delts'], tip: 'Codos apenas flexionados. Subí hasta la altura del hombro.' }),
  ex('lat_raise_cable', 'Elevaciones laterales en polea', 'lateral_raise', 'Hombros', 'isolation', B, { difficulty: 1, fatigue: 1, emphasis: ['side_delts'] }),
  ex('lat_raise_machine', 'Elevaciones laterales en máquina', 'lateral_raise', 'Hombros', 'isolation', G, { difficulty: 1, fatigue: 1, emphasis: ['side_delts'] }),
  ex('lat_raise_bw', 'Elevaciones laterales acostado', 'lateral_raise', 'Hombros', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('reverse_fly_db', 'Vuelos posteriores con mancuernas', 'rear_delt', 'Hombros', 'isolation', H, { difficulty: 1, fatigue: 1, emphasis: ['rear_delts'] }),
  ex('face_pull', 'Face pulls', 'rear_delt', 'Hombros', 'isolation', B, { difficulty: 1, fatigue: 1, emphasis: ['rear_delts'], tip: 'Codos altos. Llevá las manos a la cara.' }),
  ex('reverse_fly_machine', 'Vuelos posteriores en máquina', 'rear_delt', 'Hombros', 'isolation', G, { difficulty: 1, fatigue: 1 }),
  ex('reverse_fly_bw', 'Vuelos posteriores en el piso', 'rear_delt', 'Hombros', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('ez_curl', 'Curl con barra EZ', 'biceps', 'Bíceps', 'isolation', B, { difficulty: 1, fatigue: 1, avoidIf: ['wrist'] }),
  ex('hammer_curl', 'Curl martillo', 'biceps', 'Bíceps', 'isolation', H, { difficulty: 1, fatigue: 1, tip: 'Muñecas neutras. No balancees el torso.' }),
  ex('cable_curl', 'Curl en polea', 'biceps', 'Bíceps', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('machine_curl', 'Curl en máquina', 'biceps', 'Bíceps', 'isolation', G, { difficulty: 1, fatigue: 1 }),
  ex('towel_curl', 'Curl isométrico con toalla', 'biceps', 'Bíceps', 'isolation', W, { difficulty: 1, fatigue: 1, tip: 'Pisá la toalla y tironeá con el codo pegado.' }),
  ex('pushdown', 'Tríceps en polea', 'triceps', 'Tríceps', 'isolation', B, { difficulty: 1, fatigue: 1, tip: 'Codos quietos al costado. Estirá abajo sin adelantar el hombro.' }),
  ex('french_press', 'Press francés', 'triceps', 'Tríceps', 'isolation', H, { difficulty: 2, fatigue: 1, avoidIf: ['elbow'] }),
  ex('overhead_cable_ext', 'Extensión de tríceps sobre la cabeza', 'triceps', 'Tríceps', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('dip', 'Fondos en paralelas', 'triceps', 'Tríceps', 'compound', G, { difficulty: 2, fatigue: 2, avoidIf: ['shoulder', 'elbow'] }),
  ex('diamond_pushup', 'Flexiones diamante', 'triceps', 'Tríceps', 'compound', W, { difficulty: 2, fatigue: 1, avoidIf: ['wrist'] }),
  ex('bench_dip', 'Fondos en banco', 'triceps', 'Tríceps', 'compound', W, { difficulty: 1, fatigue: 1, avoidIf: ['shoulder'] }),
  ex('floor_tricep', 'Extensión de tríceps en el piso', 'triceps', 'Tríceps', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('kickback', 'Patada de tríceps', 'triceps', 'Tríceps', 'isolation', H, { difficulty: 1, fatigue: 1 }),
  ex('leg_extension', 'Extensión de cuádriceps', 'quad_iso', 'Piernas', 'isolation', G, { difficulty: 1, fatigue: 1, avoidIf: ['knee'], emphasis: ['quads'] }),
  ex('sissy', 'Sentadilla sissy asistida', 'quad_iso', 'Piernas', 'isolation', W, { difficulty: 2, fatigue: 1, avoidIf: ['knee'] }),
  ex('seated_knee_ext', 'Extensión de rodilla sentado', 'quad_iso', 'Piernas', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('terminal_knee', 'Extensión terminal de rodilla', 'quad_iso', 'Piernas', 'isolation', H, { difficulty: 1, fatigue: 1 }),
  ex('spanish_squat', 'Sentadilla española con banda', 'quad_iso', 'Piernas', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('leg_curl', 'Curl femoral', 'hamstring_iso', 'Piernas', 'isolation', G, { difficulty: 1, fatigue: 1, emphasis: ['hamstrings'] }),
  ex('slider_curl', 'Curl femoral en el piso', 'hamstring_iso', 'Piernas', 'isolation', W, { difficulty: 1, fatigue: 1, emphasis: ['hamstrings'] }),
  ex('db_leg_curl', 'Curl femoral con mancuerna', 'hamstring_iso', 'Piernas', 'isolation', H, { difficulty: 1, fatigue: 1 }),
  ex('cable_leg_curl', 'Curl femoral en polea', 'hamstring_iso', 'Piernas', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('glute_bridge', 'Puente de glúteo', 'glute_iso', 'Glúteos', 'isolation', F, { difficulty: 1, fatigue: 1, emphasis: ['glutes'], tip: 'Apretá arriba y bajá sin perder el contacto de la espalda alta.' }),
  ex('cable_pullthrough', 'Pull-through en polea', 'glute_iso', 'Glúteos', 'isolation', B, { difficulty: 1, fatigue: 1, emphasis: ['glutes'] }),
  ex('frog_pump', 'Frog pump', 'glute_iso', 'Glúteos', 'isolation', W, { difficulty: 1, fatigue: 1, emphasis: ['glutes'] }),
  ex('standing_calf', 'Gemelos de pie', 'calves', 'Piernas', 'isolation', F, { difficulty: 1, fatigue: 1, tip: 'Pausa abajo. Subí lo más alto que puedas.' }),
  ex('seated_calf', 'Gemelos sentado', 'calves', 'Piernas', 'isolation', G, { difficulty: 1, fatigue: 1 }),
  ex('single_calf', 'Gemelos a una pierna', 'calves', 'Piernas', 'isolation', W, { difficulty: 1, fatigue: 1 }),
  ex('plank', 'Plancha', 'core', 'Core', 'isolation', F, { difficulty: 1, fatigue: 1, tip: 'Costillas hacia abajo. No dejes caer la cadera.' }),
  ex('pallof', 'Pallof press', 'core', 'Core', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('cable_crunch', 'Crunch en polea', 'core', 'Core', 'isolation', B, { difficulty: 1, fatigue: 1 }),
  ex('leg_raise', 'Elevación de piernas', 'core', 'Core', 'isolation', W, { difficulty: 1, fatigue: 1, avoidIf: ['lower_back'] }),
  ex('ab_wheel', 'Rueda abdominal', 'core', 'Core', 'isolation', H, { difficulty: 2, fatigue: 1, avoidIf: ['lower_back'] }),
  ex('farmer', 'Farmer walk', 'carry', 'Core', 'compound', H, { difficulty: 1, fatigue: 2, tip: 'Caminá corto, torso alto, sin encoger los hombros.' }),
  ex('suitcase', 'Suitcase carry', 'carry', 'Core', 'compound', H, { difficulty: 1, fatigue: 1 }),
  ex('bear_crawl', 'Caminata del oso', 'carry', 'Core', 'compound', W, { difficulty: 1, fatigue: 1 }),
  ex('machine_carry', 'Caminata con carga en máquina', 'carry', 'Core', 'compound', G, { difficulty: 1, fatigue: 1 }),
  ex('pullover', 'Pull-over con mancuerna', 'horizontal_pull', 'Espalda', 'isolation', H, { difficulty: 1, fatigue: 1, avoidIf: ['shoulder'] }),
  ex('decline_pushup', 'Flexiones declinadas', 'horizontal_push', 'Pecho', 'compound', W, { difficulty: 2, fatigue: 1, emphasis: ['upper_chest'] }),
  ex('cardio_walk', 'Cardio suave', 'cardio', 'Otro', 'isolation', F, { difficulty: 1, fatigue: 1, tip: 'Caminadora en pendiente o bici, a un ritmo en el que puedas hablar.' }),
  ex('cardio_row', 'Remo ergómetro suave', 'cardio', 'Otro', 'isolation', G, { difficulty: 1, fatigue: 1 }),
];

const required = ['key', 'name', 'pattern', 'muscleGroup', 'primary', 'secondary', 'type', 'equipment', 'difficulty', 'fatigue', 'avoidIf', 'emphasis', 'tip', 'linkLabel'];
const keys = new Set();
list.forEach((item) => {
  if (keys.has(item.key)) throw new Error('key repetida ' + item.key);
  keys.add(item.key);
  required.forEach((field) => {
    if (item[field] == null) throw new Error(item.key + ' sin ' + field);
  });
});
const patterns = [...new Set(list.map((item) => item.pattern))];
const equipments = ['full_gym', 'basic_gym', 'home_dumbbells', 'bodyweight'];
patterns.forEach((pattern) => {
  equipments.forEach((equipment) => {
    const hit = list.some((item) => item.pattern === pattern && item.equipment.includes(equipment) && item.difficulty <= 2 && !item.avoidIf.length);
    if (!hit) throw new Error('falta opción fácil sin lesión: ' + pattern + ' / ' + equipment);
  });
});
fs.writeFileSync(path.join(__dirname, 'exercise-catalog.json'), JSON.stringify(list, null, 2));
console.log('ejercicios', list.length, 'patrones', patterns.length);
