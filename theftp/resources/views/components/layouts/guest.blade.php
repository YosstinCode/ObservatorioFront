<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    {{-- Token CSRF para seguridad en formularios y peticiones AJAX --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">

    {{-- Título dinámico de la página de autenticación --}}
    <title>{{ config('app.name', 'Laravel') }} - Autenticación</title>

    {{-- Carga de fuentes y tipografías del proyecto --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        rel="stylesheet">

    {{-- Estilos globales + scripts necesarios para la vista de login/register --}}
    @vite(['resources/js/app.js', 'resources/js/alert.js'])
</head>

<body class="font-sans text-gray-900 antialiased">
    <div class="min-h-screen flex flex-col justify-center items-center py-12 px-4">

        {{--
        Botón de "Volver al inicio"
        - Incluye icono de flecha dentro de un contorno.
        - Uso de gap, padding y hover para dar sensación más pulida.
        - Se posiciona arriba a la izquierda para fácil acceso.
        --}}
        <a href="{{ url('/') }}" class="absolute top-6 left-6 flex items-center gap-3 pl-3 pr-6 py-2 rounded-full text-white font-semibold shadow-md
                  hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
            style="background-color: var(--accent-green);" {{-- Color institucional --}}
            aria-label="Volver a la página principal">

            {{-- Icono circular con la flecha de volver --}}
            <span class="flex items-center justify-center w-8 h-8 border-2 border-white rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                    stroke="white" class="w-5 h-5 transition-transform group-hover:-translate-x-1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
            </span>

            {{-- Texto del botón (oculto en pantallas pequeñas para no estorbar) --}}
            <span class="text-sm hidden sm:inline">
                Volver a Inicio
            </span>
        </a>

        {{-- Aquí se carga dinámicamente el contenido de login o registro --}}
        {{ $slot }}

    </div>
</body>

</html>