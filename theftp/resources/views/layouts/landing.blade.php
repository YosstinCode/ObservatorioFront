<!DOCTYPE html>
{{-- Configuración básica del documento HTML --}}
<html lang="es" style="scroll-behavior: smooth;">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    {{-- Token CSRF para proteger formularios y peticiones AJAX en Laravel --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">

    {{-- Título del proyecto que aparece en la pestaña del navegador --}}
    <title>Observatorio de Transporte - Alcaldía de Girardot</title>

    {{-- Carga anticipada de Google Fonts para mejorar rendimiento --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    {{-- Tipografías principales del sitio --}}
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&family=Krona+One&display=swap"
        rel="stylesheet">

    {{-- Archivos principales generados por Vite (CSS y JS del proyecto) --}}
    @vite(['resources/js/app.js'])

</head>

<body style="overflow-x: hidden;">

    {{-- Aquí se insertará el contenido de cada vista que use este layout --}}
    @yield('content')

</body>

</html>