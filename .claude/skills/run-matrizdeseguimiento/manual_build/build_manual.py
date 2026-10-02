# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle,
    ListFlowable, ListItem, KeepTogether, HRFlowable
)
from reportlab.platypus.flowables import Flowable
from PIL import Image as PILImage

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.abspath(os.path.join(BASE, "..", "screenshots", "manual3"))
OUT = os.path.join(BASE, "Manual-Matriz-de-Seguimiento.pdf")

PAGE_W, PAGE_H = A4
MARGIN = 2.0 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------- Paleta
NAVY = colors.HexColor('#1F2937')
TEAL = colors.HexColor('#0891B2')
TEAL_LIGHT = colors.HexColor('#ECFEFF')
SLATE = colors.HexColor('#475569')
SLATE_LIGHT = colors.HexColor('#64748B')
BORDER = colors.HexColor('#E2E8F0')
GREEN = colors.HexColor('#3F7D5C')
AMBER = colors.HexColor('#B45309')
AMBER_BG = colors.HexColor('#FEF3C7')
RED = colors.HexColor('#B91C1C')

styles = getSampleStyleSheet()

styles.add(ParagraphStyle('Portada', parent=styles['Title'], fontSize=30, leading=36,
                           textColor=NAVY, alignment=TA_CENTER, spaceAfter=6))
styles.add(ParagraphStyle('PortadaSub', parent=styles['Normal'], fontSize=14, leading=20,
                           textColor=TEAL, alignment=TA_CENTER, spaceAfter=4))
styles.add(ParagraphStyle('PortadaMeta', parent=styles['Normal'], fontSize=10.5, leading=15,
                           textColor=SLATE_LIGHT, alignment=TA_CENTER))

styles.add(ParagraphStyle('H1', parent=styles['Heading1'], fontSize=19, leading=23,
                           textColor=NAVY, spaceBefore=4, spaceAfter=12,
                           borderColor=TEAL, borderWidth=0, ))
styles.add(ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13.5, leading=17,
                           textColor=TEAL, spaceBefore=14, spaceAfter=7))
styles.add(ParagraphStyle('Body', parent=styles['Normal'], fontSize=10.3, leading=15,
                           textColor=colors.HexColor('#1E293B'), spaceAfter=7, alignment=TA_LEFT))
styles.add(ParagraphStyle('BodyBold', parent=styles['Body'], fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('MiBullet', parent=styles['Body'], leftIndent=0, spaceAfter=4))
styles.add(ParagraphStyle('Caption', parent=styles['Normal'], fontSize=8.7, leading=11.5,
                           textColor=SLATE_LIGHT, alignment=TA_CENTER, spaceBefore=4, spaceAfter=14,
                           fontName='Helvetica-Oblique'))
styles.add(ParagraphStyle('TipTitle', parent=styles['Body'], fontName='Helvetica-Bold',
                           textColor=TEAL, spaceAfter=2))
styles.add(ParagraphStyle('TocEntry', parent=styles['Body'], fontSize=11, leading=18,
                           textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle('TocSection', parent=styles['Body'], fontSize=11.5, leading=20,
                           fontName='Helvetica-Bold', textColor=TEAL, spaceBefore=8, spaceAfter=2))
styles.add(ParagraphStyle('FooterSmall', parent=styles['Normal'], fontSize=8, textColor=SLATE_LIGHT))

story = []


def h1(text):
    story.append(HRFlowable(width=CONTENT_W, thickness=2, color=TEAL, spaceAfter=6))
    story.append(Paragraph(text, styles['H1']))


def h2(text):
    story.append(Paragraph(text, styles['H2']))


def p(text):
    story.append(Paragraph(text, styles['Body']))


def bullets(items):
    story.append(ListFlowable(
        [ListItem(Paragraph(it, styles['MiBullet']), leftIndent=12, value='•') for it in items],
        bulletType='bullet', start='•', leftIndent=14, spaceBefore=2, spaceAfter=10,
    ))


def img(filename, caption=None, max_w=CONTENT_W, max_h_cm=15.5):
    path = os.path.join(SHOTS, filename)
    with PILImage.open(path) as im:
        iw, ih = im.size
    max_h = max_h_cm * cm
    ratio = min(max_w / iw, max_h / ih)
    w, h = iw * ratio, ih * ratio
    story.append(Spacer(1, 4))
    # Marco sutil alrededor de la captura
    tbl = Table([[Image(path, width=w, height=h)]], colWidths=[w])
    tbl.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    wrapper = Table([[tbl]], colWidths=[CONTENT_W])
    wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    story.append(wrapper)
    if caption:
        story.append(Paragraph(caption, styles['Caption']))
    else:
        story.append(Spacer(1, 10))


def tip(title, text):
    data = [[Paragraph(f"<b>{title}</b><br/>{text}", styles['Body'])]]
    t = Table(data, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TEAL_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.75, TEAL),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 4))
    story.append(t)
    story.append(Spacer(1, 10))


def estado_tabla():
    celda_estilo = ParagraphStyle('CeldaTabla', parent=styles['Body'], fontSize=9.3, leading=12.5, spaceAfter=0)
    celda_header = ParagraphStyle('CeldaHeader', parent=celda_estilo, fontName='Helvetica-Bold', textColor=colors.white)

    filas_texto = [
        ('Sin iniciar', 'Todavía no se ha tocado este paso.'),
        ('En proceso', 'Alguien ya está trabajando en él. Puede dejarse una nota de "Encargado de este '
                       'paso" (en mayúscula automáticamente).'),
        ('Pendiente jefe', 'Necesita una decisión o visto bueno de la jefatura. Avisa por correo al '
                           'encargado de la categoría "jefe".'),
        ('En ajustes', 'Se pidieron correcciones y se está a la espera de la nueva versión.'),
        ('Por revisar', 'Está listo para que alguien más lo revise antes de cerrarlo.'),
        ('Terminado', 'El paso quedó completo. Pide fecha de terminado (y comentario, si el paso lo '
                      'exige).'),
    ]
    data = [[Paragraph('Estado', celda_header), Paragraph('Qué significa', celda_header)]]
    for nombre, explicacion in filas_texto:
        data.append([Paragraph(f"<b>{nombre}</b>", celda_estilo), Paragraph(explicacion, celda_estilo)])

    t = Table(data, colWidths=[3.4 * cm, CONTENT_W - 3.4 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.3),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))


# ============================================================ PORTADA
story.append(Spacer(1, 6.5 * cm))
story.append(Paragraph("Matriz de Seguimiento", styles['Portada']))
story.append(Paragraph("Manual de usuario", styles['PortadaSub']))
story.append(Spacer(1, 0.6 * cm))
story.append(HRFlowable(width=6 * cm, thickness=1.2, color=TEAL, hAlign='CENTER'))
story.append(Spacer(1, 0.6 * cm))
story.append(Paragraph("Universidad Santo Tomás &middot; Campus Virtual", styles['PortadaMeta']))
story.append(Paragraph("Versión actualizada &middot; incluye todas las funciones más recientes", styles['PortadaMeta']))
story.append(PageBreak())

# ============================================================ CONTENIDO
story.append(Paragraph("Contenido", styles['H1']))
secciones = [
    "1. Qué es la Matriz de Seguimiento",
    "2. Ingresar al sistema",
    "3. Programas",
    "4. Crear y editar una asignatura",
    "5. El tablero de apartados",
    "6. Abrir un apartado y trabajar un paso",
    "7. La fecha de terminado",
    "8. Encargado de este paso",
    "9. Puntos de decisión (¿Hay ajustes?)",
    "10. Pasos que se completan solos",
    "11. Instancias repetibles: agregar, quitar, bloquear",
    "12. Navegar con el teclado",
    "13. Cuando una asignatura llega al 100%",
    "14. Exportar a Excel",
    "15. Encargados por categoría (avisos por correo)",
    "16. Pendientes",
    "17. Dashboard",
    "18. Usuarios y roles",
    "19. Actividad",
    "20. Modo oscuro",
    "21. Glosario de estados",
]
for s in secciones:
    story.append(Paragraph(s, styles['TocEntry']))
story.append(PageBreak())

# ============================================================ 1. INTRO
h1("1. Qué es la Matriz de Seguimiento")
p("Es la aplicación que reemplaza la antigua matriz en Excel para llevar el control del proceso de "
  "producción de cada espacio académico virtual o híbrido: desde la firma de cesión de derechos hasta "
  "el montaje final en la plataforma. Organiza el trabajo por <b>programas</b>, que contienen "
  "<b>asignaturas</b>, que se dividen en <b>apartados</b> (Libro, OVA, Podcast, Guías, etc.), cada uno "
  "con sus propios <b>pasos</b> puntuales.")
p("Cada paso tiene un estado (Sin iniciar, En proceso, Pendiente jefe, En ajustes, Por revisar o "
  "Terminado), y la aplicación calcula solo el avance de cada asignatura, de cada apartado y de cada "
  "programa, además de avisar por correo cuando algo se está por vencer.")
tip("¿Y la matriz vieja de Excel?",
    "El enlace \"Matriz antigua\" en la barra superior sigue disponible para consultar el histórico "
    "anterior a esta aplicación.")

# ============================================================ 2. LOGIN
h1("2. Ingresar al sistema")
p("Se ingresa con el correo y la contraseña asignados. Si no se recuerda la contraseña, el enlace "
  "\"¿Olvidaste tu contraseña?\" de la pantalla de ingreso envía un correo con un link para restablecerla.")
img("01-login.png", "Pantalla de ingreso.")
p("Un administrador puede crear cuentas nuevas desde \"Usuarios\" en la barra superior (ver sección 18).")

# ============================================================ 3. PROGRAMAS
h1("3. Programas")
p("Al ingresar se ve el listado de programas. Cada uno puede ser <b>Presencial</b> (con alguna "
  "asignatura virtual puntual), <b>Virtual</b> o <b>Híbrido</b> (mezcla asignaturas presenciales y "
  "virtuales, cada una elige su propia modalidad). Los filtros de arriba permiten ver solo un tipo, y "
  "dentro de \"Virtual\" hay un sub-filtro de pregrado/posgrado.")
img("02-programas-listado.png", "Listado de programas, con filtros y buscador.")
p("El botón <b>Exportar a Excel</b> descarga la matriz completa de todos los programas activos, una "
  "hoja por programa (ver sección 14). \"Nuevo programa\" crea uno; cada tarjeta de la lista se puede "
  "editar o archivar sin perder sus asignaturas.")
p("Al entrar a un programa se ve el tablero: una tarjeta por asignatura, con un chip de color por cada "
  "apartado (Libro, OVA, Podcast...) que resume en qué estado va. Las flechitas junto al nombre del "
  "programa pasan al programa anterior/siguiente sin volver al listado.")

# ============================================================ 4. ASIGNATURA
h1("4. Crear y editar una asignatura")
p("Desde \"Nueva asignatura\" se elige el semestre, los créditos (de 1 a 5 — de eso depende cuántas "
  "instancias de OVA, Video, Guía, etc. corresponden), el nombre del espacio académico y los docentes "
  "asignados. En un programa híbrido también se elige la modalidad (presencial/virtual) de esa "
  "asignatura puntual; en un programa presencial se pide en cambio el nombre del programa académico.")
img("16-nueva-asignatura.png", "Formulario de una asignatura nueva, dentro de un programa híbrido.")
p("La casilla \"¿El nombre del espacio académico es diferente al del libro?\" muestra, al marcarla, un "
  "campo para escribir el nombre del libro cuando no coincide con el del espacio académico.")
p("Ya creada, la asignatura se edita o elimina desde su propia página (botones \"Editar\"/\"Eliminar\" "
  "arriba a la derecha). Eliminar borra también todo su avance y su historial — no se puede deshacer.")

# ============================================================ 5. TABLERO APARTADOS
h1("5. El tablero de apartados")
p("La página de una asignatura lista todos sus apartados como tarjetas rectangulares. El color de cada "
  "una resume el estado de sus pasos:")
bullets([
    "<b>Blanco / gris claro</b> — sin iniciar.",
    "<b>Rojo</b> — en proceso (alguien lo está trabajando).",
    "<b>Amarillo</b> — pendiente jefe o en ajustes (necesita atención).",
    "<b>Verde</b> — terminado.",
    "<b>Gris punteado con candado</b> — el apartado está bloqueado (no aplica a esta asignatura) o es "
    "una instancia extra que todavía se puede agregar (\"+ Agregar OVA 5\", por ejemplo).",
])
img("04-asignatura-completa.png", "Página de una asignatura, con todos sus apartados y el pie de "
    "leyenda de estados.")
p("Al hacer clic en una tarjeta se abre una ventana con todos los pasos de ese apartado (o, si el "
  "apartado tiene varias instancias como OVA o Guía, primero un selector de cuál instancia abrir).")

# ============================================================ 6. TRABAJAR UN PASO
h1("6. Abrir un apartado y trabajar un paso")
p("Dentro de la ventana de un apartado, cada paso es una ficha pequeña con su nombre y su estado "
  "actual. Al hacer clic se abre el panel completo de ese paso.")
img("06-apartado-abierto.png", "Ventana del apartado \"Libro\", con todas sus fichas de paso.")
img("07-panel-paso.png", "Panel de un paso: Estado, fechas y detalles.")
p("El panel siempre tiene una sección <b>Estado</b> (los 6 estados posibles), una sección "
  "<b>Fechas</b> y, si el paso lo requiere, campos de <b>comentario</b> (a veces obligatorios para "
  "poder marcarlo como terminado). El botón \"Guardar cambios\" pide confirmar antes de aplicar — así "
  "no se guarda nada por accidente.")
p("Un candado en una ficha significa que hay que completar primero el paso anterior de ese mismo "
  "apartado — la aplicación no deja adelantarse fuera de orden.")

# ============================================================ 7. FECHA TERMINADO
h1("7. La fecha de terminado")
p("El campo \"Fecha de terminado\" solo se puede editar cuando el estado es <b>Terminado</b>. En "
  "cualquier otro estado queda deshabilitado y se guarda solo con la fecha de hoy — así esa fecha "
  "siempre refleja de verdad cuándo se cerró el paso, no una fecha puesta a mano por error mientras "
  "seguía en proceso.")
p("Al elegir \"Terminado\" el campo se habilita para poder ajustar la fecha si hace falta (por ejemplo, "
  "para registrar que en realidad se terminó unos días antes).")

# ============================================================ 8. ENCARGADO DEL PASO
h1("8. Encargado de este paso")
p("Cuando un paso queda en estado <b>En proceso</b>, aparece un campo de texto libre \"Encargado de "
  "este paso\" para anotar quién quedó siguiéndolo — útil cuando la persona que lo puso en proceso no "
  "es la misma que lo va a resolver. Es solo una nota visible en el panel y en la ficha del paso "
  "(con un ícono de persona); no dispara ningún aviso por correo.")
img("09-panel-en-proceso-encargado.png", "Estado \"En proceso\" con el campo de encargado del paso.")
p("El texto se convierte solo a MAYÚSCULA mientras se escribe, y queda guardado así aunque el paso se "
  "marque como terminado después -- no se borra al cambiar de estado.")

# ============================================================ 9. DECISION
h1("9. Puntos de decisión (¿Hay ajustes?)")
p("Algunos pasos (por ejemplo en Rutas, OVA, Podcast o Video) son una decisión: \"¿Hay ajustes?\". Si "
  "hay ajustes, se habilitan los pasos de solicitud y validación de esos ajustes. Si no los hay, el "
  "proceso sigue derecho al siguiente paso.")
img("08-panel-decision.png", "Panel de un paso de decisión, con \"No hay ajustes\" ya elegido.")
p("Al elegir \"No hay ajustes\", el estado del paso pasa solo a <b>Terminado</b> (con la fecha de hoy) "
  "-- no hace falta ir aparte a la sección Estado a marcarlo.")

# ============================================================ 10. AUTOCOMPLETA
h1("10. Pasos que se completan solos")
p("Para no repetir el mismo dato paso por paso cuando en la práctica se resuelven todos juntos, la "
  "aplicación completa algunos pasos de forma automática:")
bullets([
    "<b>Entre instancias del mismo bloque</b> — al terminar \"Creación de guión\" (o cualquier paso "
    "\"de siempre igual\") en OVA 1, se completa solo en OVA 2, OVA 3... si todavía estaban vacías.",
    "<b>Dentro del mismo apartado (Estructura)</b> — al marcar \"Reunión inicial\" como terminada, se "
    "completan solas también \"Revisión estructura por experto\" y \"Estructura final\".",
])
p("En ningún caso se pisa un paso que alguien ya haya tocado a mano — solo se completan los que "
  "seguían vacíos.")

# ============================================================ 11. INSTANCIAS
h1("11. Instancias repetibles: agregar, quitar, bloquear")
p("Los apartados que se repiten por créditos (OVA, Podcast, Video de contenido, Guía, Infografía) "
  "muestran una tarjeta por instancia (OVA 1, OVA 2...). Cada una tiene su propio ícono de basura para "
  "<b>quitarla</b> si al final no se va a hacer — se pierde su avance guardado, así que pide "
  "confirmación.")
p("Si <b>todas</b> las instancias garantizadas por créditos de un apartado se quitan, el apartado "
  "completo queda marcado como \"bloqueado\" (no aplica a esta asignatura), con un botón para "
  "\"Desbloquear\" si se necesita reactivarlo más adelante.")
tip("Instancias extra",
    "Algunos apartados (Podcast, Video de contenido, Guía, Infografía) dejan agregar una instancia más "
    "allá de lo que corresponde por créditos, con el botón punteado \"+ Agregar...\". Si un apartado "
    "está bloqueado pero alguna instancia extra ya tiene datos guardados, esa instancia se sigue "
    "mostrando aparte para poder quitarla, en vez de quedar escondida contando en el avance para "
    "siempre.")

# ============================================================ 12. TECLADO
h1("12. Navegar con el teclado")
p("Toda la matriz se puede recorrer sin usar el mouse:")
bullets([
    "Al abrir un apartado, la primera ficha de paso ya queda enfocada sola.",
    "Las <b>flechas</b> del teclado (arriba, abajo, izquierda, derecha) mueven el foco entre las "
    "fichas de los pasos, o entre las opciones de "
    "Estado / \"¿Hay ajustes?\" dentro del panel de un paso.",
    "<b>Enter</b> abre la ficha enfocada, o — dentro del panel de un paso — elige la opción enfocada "
    "la primera vez y guarda los cambios la segunda.",
])
img("17-flechas-foco.png", "El anillo celeste marca cuál ficha está enfocada al moverse con las flechas.")
p("Un anillo celeste alrededor del botón enfocado deja claro en todo momento dónde está el foco del "
  "teclado.")

# ============================================================ 13. 100%
h1("13. Cuando una asignatura llega al 100%")
p("En cuanto todos los pasos visibles de una asignatura quedan en \"Terminado\", en su página (y en su "
  "tarjeta del tablero) aparece la etiqueta verde <b>Por ofertar</b>, y junto a ella dos botones "
  "nuevos:")
bullets([
    "<b>Reiniciar matriz</b> — borra todo el avance de los pasos y los docentes asignados, como si el "
    "proceso empezara de nuevo con la asignatura ya creada. Pide confirmación porque no se puede "
    "deshacer desde la propia pantalla.",
    "<b>Copias de seguridad</b> (solo administradores) — antes de reiniciar, la aplicación guarda "
    "automáticamente una copia completa de cómo estaba todo. Desde acá se puede revisar esa copia o "
    "restaurarla con un clic.",
])
img("05-copias-seguridad.png", "Ventana de copias de seguridad, con una copia guardada y su botón "
    "Restaurar.")
tip("¿Se puede perder información sin querer?",
    "No: cada reinicio deja su propia copia, así que siempre se puede volver atrás. Además, el "
    "historial de \"Actividad\" (sección 19) guarda por separado cada cambio de estado y comentario "
    "que se haya hecho.")

# ============================================================ 14. EXCEL
h1("14. Exportar a Excel")
p("Hay dos formas de exportar, con el mismo formato:")
bullets([
    "<b>Toda la matriz</b> — botón \"Exportar a Excel\" en el listado de Programas. Genera un libro "
    "con una hoja por programa activo.",
    "<b>Una sola asignatura</b> — botón \"Exportar Excel\" en la página de esa asignatura.",
])
p("El encabezado va en dos filas, agrupando las columnas por apartado con una banda de color (igual "
  "de espíritu que la matriz de Excel original), y cada celda muestra el estado junto con la fecha y "
  "las iniciales de quien lo guardó (por ejemplo \"Terminado · 15/09 · CP\"), igual que se ve en la "
  "ficha del paso dentro de la aplicación.")

# ============================================================ 15. ENCARGADOS
h1("15. Encargados por categoría (avisos por correo)")
p("No todos los apartados tienen un paso con fecha límite -- solo avisan por correo los que sí la "
  "tienen:")
bullets([
    "<b>Libro</b> -- \"Envío para ajustes de experto\" (la fecha límite sale sola, días hábiles "
    "después de la fecha de envío).",
    "<b>Podcast</b> -- \"Creación de guión\".",
    "<b>Video de contenido</b> -- \"Creación de guión\", pero <b>solo</b> cuando el video lo graba el "
    "profesor (modo \"Video tutorial\"); si lo graba el equipo, ese paso no tiene fecha límite y no "
    "avisa.",
    "<b>Cuestionario final</b> -- \"Recepción por experto\".",
    "<b>Tipo de contrato</b> -- no tiene fecha límite propia, pero avisa por separado cuando se acerca "
    "la fecha de fin de contrato de un docente.",
])
p("<b>OVA</b> y <b>Guías</b> tienen su propio encargado configurable en Usuarios, pero hoy ninguno de "
  "sus pasos pide fecha límite -- así que, aunque el selector existe, todavía no disparan ningún "
  "aviso por correo.")
p("El estado <b>\"Pendiente jefe\"</b> es distinto: se puede elegir en cualquier paso, de cualquier "
  "apartado, y no manda ningún correo -- solo queda registrado en la matriz (se ve en Pendientes, en "
  "el Dashboard y en Actividad).")
p("Cada categoría tiene un encargado general (se configura en Usuarios), pero dentro del panel de un "
  "paso puntual (cuando ese paso sí dispara avisos) se puede asignar un encargado <b>propio de esa "
  "asignatura</b>, que pisa al general solo ahí. Cualquier usuario con sesión puede cambiar ese "
  "encargado propio, no hace falta ser administrador.")

# ============================================================ 16. PENDIENTES
h1("16. Pendientes")
p("El botón \"Ver pendientes\" de un programa arma un reporte de todo lo que falta por asignatura: "
  "cada paso que todavía no está en \"Terminado\", agrupado y con el porcentaje de avance de cada una.")
img("11-pendientes.png", "Reporte de pendientes de un programa.")

# ============================================================ 17. DASHBOARD
h1("17. Dashboard")
p("Da una vista general de toda la aplicación, no solo de un programa: avance global, alertas de "
  "fechas límite y contratos por vencer, pasos terminados por semana, avance por estado, por apartado "
  "y por programa, y las asignaturas más atrasadas.")
img("10-dashboard-top.png", "Parte superior del Dashboard: avance global, indicadores y alertas de "
    "fechas por vencer. Más abajo siguen las gráficas de avance por estado, por apartado, por "
    "programa y las asignaturas más atrasadas.", max_h_cm=11)

# ============================================================ 18. USUARIOS
h1("18. Usuarios y roles")
p("Hay dos roles: <b>Usuario</b> y <b>Administrador</b>. Ambos pueden ver y editar la matriz por "
  "igual (incluido asignar el encargado propio de una asignatura, ver sección 15). Lo que distingue a "
  "un administrador es el acceso a la página \"Usuarios\" (crear cuentas, cambiar roles o "
  "contraseñas), a \"Copias de seguridad\" de una asignatura, y a asignar los encargados "
  "<b>generales</b> por categoría.")
p("Desde \"Usuarios\" (solo administradores) se crean las cuentas nuevas, se activan/desactivan, se "
  "cambia el rol, y se configuran los encargados generales de cada categoría.")

# ============================================================ 19. ACTIVIDAD
h1("19. Actividad")
p("Registra, en orden del más reciente al más antiguo, cada cambio de estado o de comentario guardado "
  "en cualquier asignatura de la aplicación: quién lo hizo, en qué apartado y a qué paso, y el cambio "
  "de estado exacto (por ejemplo \"Sin iniciar a Terminado\"). Es la bitácora completa de la matriz, "
  "visible para todos.")
img("13-actividad-top.png", "Registro de actividad reciente (los cambios más nuevos van primero).",
    max_h_cm=11)

# ============================================================ 20. MODO OSCURO
h1("20. Modo oscuro")
p("El ícono de luna/sol junto al avatar, arriba a la derecha, cambia entre modo claro y oscuro para "
  "toda la aplicación.")
img("14-modo-oscuro.png", "Listado de programas en modo oscuro.")
p("En modo oscuro el logo cambia solo por su versión en blanco, para que se siga viendo bien sobre el "
  "fondo oscuro de la barra superior.")
img("15-apartado-oscuro.png", "Un apartado abierto en modo oscuro.")

# ============================================================ 21. GLOSARIO
h1("21. Glosario de estados")
estado_tabla()
p("Además de estos seis estados, algunas fichas muestran un candado (paso bloqueado por el anterior, "
  "o apartado bloqueado por completo) o quedan punteadas con \"+ Agregar...\" (instancia extra "
  "todavía no creada).")

story.append(Spacer(1, 20))
story.append(HRFlowable(width=CONTENT_W, thickness=0.75, color=BORDER))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Ante cualquier duda que no quede clara en este manual, comunícate con el equipo de Campus Virtual.",
    styles['FooterSmall']))


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(SLATE_LIGHT)
    canvas.drawCentredString(PAGE_W / 2, 1.2 * cm, f"{doc.page}")
    canvas.drawString(MARGIN, PAGE_H - 1.3 * cm, "Matriz de Seguimiento — Manual de usuario")
    canvas.setStrokeColor(BORDER)
    canvas.line(MARGIN, PAGE_H - 1.4 * cm, PAGE_W - MARGIN, PAGE_H - 1.4 * cm)
    canvas.restoreState()


def first_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 0.4 * cm, PAGE_W, 0.4 * cm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, 0, PAGE_W, 0.25 * cm, fill=1, stroke=0)
    canvas.restoreState()


doc = SimpleDocTemplate(OUT, pagesize=A4,
                         leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                         title="Manual de Usuario - Matriz de Seguimiento")

doc.build(story, onFirstPage=first_page, onLaterPages=add_page_number)
print("OK ->", OUT)
