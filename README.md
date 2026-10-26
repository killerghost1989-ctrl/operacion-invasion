# OPERACIÓN ÚLTIMA COLONIA — prototipo 0.1
Servidor autoritativo Node.js + Socket.IO; cliente HTML5 Canvas (sin instalar nada en los celulares).

## Ejecutar en tu computadora
    npm install
    npm start        # http://localhost:3000
Prueba rápida: abre dos pestañas. En una "Crear sala"; en la otra escribe el código y "Unirme". Ambos pulsan ¡LISTO!. En PC: WASD/flechas para mover, Espacio para revivir.

## Publicar en internet (ej. Render.com, gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: New → Web Service → elige el repo. Build: `npm install`. Start: `npm start`.
3. Render te da una URL https://tu-juego.onrender.com — ábrela en ambos celulares (en horizontal).
Alternativas: Railway, Fly.io, un VPS. El plan gratis de Render se duerme tras inactividad (el primer acceso tarda ~1 min): ábranlo un par de minutos antes de jugar.

## Cómo jugar
CORONEL: "Crear sala" → te da un código de 4 letras → mándaselo a Vicky por WhatsApp. VICKY: escribe el código → "Unirme". Ambos "¡LISTO!".
Joystick: tocar y arrastrar en la mitad izquierda. Disparo: automático. Botón REVIVIR (aparece si el compañero cayó): mantenlo 3 s estando cerca. Si pierden la señal, al reabrir la página se reconectan solos a su soldado.

## Pendiente (siguientes etapas)
Habilidades (bombardeo orbital / pulso EM), Escupidor, jefe TITÁN, armas extra, indicadores de enemigos fuera de pantalla, sprites/animaciones y sonidos reales, pausa, anti-trampas más estrictas.
