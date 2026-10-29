# OPERACIÓN ÚLTIMA COLONIA — versión 0.2
Servidor autoritativo Node.js + Socket.IO; cliente HTML5 Canvas (sin instalar nada en los celulares).

## Novedades de la 0.2
- **5 alienígenas**: Rastreador (oleada 1), Cazador (3), Acorazado (5), Escupidor (7) y Explosivo (9).
- **3 jefes**: Devorador (oleada 5), Reina Ácida (10) y Titán (15). Se repiten más fuertes en 20, 25, 30...
- **Oleadas progresivas** según la tabla de diseño; desde la 16 se calcula con una fórmula.
- **Máximo 25 enemigos activos**; el resto entra poco a poco al caer los demás.
- **12 puntos de aparición** repartidos por los bordes, lejos de los soldados y del reactor.
- **Obstáculos sólidos** (pilares y rocas): ni soldados ni alienígenas los atraviesan.
- **IA ligera** por reglas: perseguir, rodear obstáculos, no amontonarse, mantener distancia (Escupidor).
- **Interfaz**: vidas, reactor, oleada, enemigos restantes, cuenta regresiva, conexión, barra de jefe,
  avisos de oleada y de lado de invasión, minimapa.
- **Dibujos 2D** con patas animadas, destello al recibir daño, efectos de muerte y explosión.
- El reactor se repara un poco al superar cada oleada (más si cae un jefe).
- Si ninguno de los dos jugadores está conectado, la partida se congela hasta que alguien regrese.

## Ejecutar en tu computadora
    npm install
    npm start        # http://localhost:3000
Prueba rápida: abre dos pestañas. En una "Crear sala"; en la otra escribe el código y "Unirme". Ambos pulsan ¡LISTO!.
En PC: WASD/flechas para mover, Espacio para revivir.

## Publicar en internet (Render.com, gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: New → Web Service → elige el repo. Build: `npm install`. Start: `npm start`.
3. Render te da una URL https://tu-juego.onrender.com — ábrela en ambos celulares (en horizontal).
El plan gratis de Render se duerme tras inactividad (el primer acceso tarda ~1 min): ábranlo un par de minutos antes de jugar.

## Cómo jugar
CORONEL: "Crear sala" → te da un código de 4 letras → mándaselo a Vicky por WhatsApp. VICKY: escribe el código → "Unirme". Ambos "¡LISTO!".
Joystick: tocar y arrastrar en la mitad izquierda. Disparo: automático. Botón REVIVIR (aparece si el compañero cayó): mantenlo 3 s estando cerca.
Si pierden la señal, al reabrir la página se reconectan solos a su soldado.

## Ajustar la dificultad
Todo está al inicio de `server.js`, en los bloques `CFG`, `OLEADAS` y `TIPOS`
(salud, velocidad, daño, tamaño, oleada de aparición y frecuencia de cada alienígena y jefe).

## Pendiente
Habilidades (bombardeo orbital / pulso EM), armas extra, sonidos reales, pausa, anti-trampas más estrictas.
