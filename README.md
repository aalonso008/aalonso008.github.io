# Tu Rutina

PWA para armar una rutina de gimnasio y anotar el peso de cada serie. Funciona sin cuenta: los datos quedan en el dispositivo. Si configurás Supabase, también se pueden sincronizar.

## Cómo correrla

```bash
npm install
npm start
```

Abrí `http://localhost:3000`. En el celular, usá la misma red y la IP de la compu.

Los tests de las fórmulas:

```bash
node --test tests/run.test.js
```

También se pueden abrir en `tests/index.html`.

## Estructura

- `index.html` — cáscara de la app
- `js/storage.js` — único lugar que toca `localStorage`
- `js/model.js` — series, migración v1→v2, ids
- `js/body-calc.js` — IMC, grasa, FFMI, calorías
- `js/progression-calc.js` — 1RM, doble progresión, ciclo
- `js/sync.js` — Supabase, opcional
- `data/default-routine.json` — rutina de ejemplo en formato v2
- `supabase/schema.sql` — tablas y RLS

## Modelo v2

La rutina guarda ejercicios como `{ id, exerciseId, sets }`. `sets` es `{ count, repMin, repMax, restSec, note }`.

El nombre, el grupo muscular y la técnica viven en `tu_rutina_exercises`. Por eso renombrar un ejercicio no corta el historial.

Cada serie está en `gym_sets`: peso, reps, RPE opcional (6–10, de a 0.5) y `exerciseId`.

Al abrir la app, si los datos son v1 se hace una copia en `tu_rutina_data_backup_v1` y `gym_logs_backup_v1` y se migran solos.

## Supabase

1. Creá un proyecto en [Supabase](https://supabase.com).
2. En el SQL editor, ejecutá `supabase/schema.sql`.
3. Authentication → URL Configuration: agregá la página de la app, por ejemplo `http://localhost:3000/app.html` y `https://aalonso008.github.io/app.html`. Ahí vuelve Google, el enlace y el recupero de contraseña.
4. Authentication → Providers → Email: dejalo activo. Sirve para crear la cuenta con contraseña y para el enlace de quienes ya entraban así.
5. Authentication → Providers → Google: activalo con el Client ID y el secret. En Google Cloud, el redirect autorizado es `https://TU_PROYECTO.supabase.co/auth/v1/callback`.
6. Un Google con el mismo email verificado entra a la cuenta que ya existe. Supabase vincula esa identidad al mismo usuario: no se crea otra cuenta y la rutina sigue en ese `user_id`.
7. El botón «Vincular Google» dentro de Cuenta pide Authentication → Providers → Manual linking. Sin eso, alcanza con cerrar sesión y tocar Continuar con Google usando el mismo mail.
8. Copiá `js/config.example.js` sobre `js/config.js` y completá `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Project Settings → API). La anon key es pública; RLS limita cada fila a su usuario.

Sin `config.js` completo, el botón Cuenta explica que todo sigue en el dispositivo.

El primer login pregunta si subir los datos locales, combinarlos o usar los de la cuenta.
