"""
Convierte la documentacion Markdown a un HTML listo para imprimir como PDF.
Genera un archivo HTML auto-contenido con estilos de impresion.
"""

import re
import markdown

INPUT = r"C:\Users\Amaury\.gemini\antigravity\brain\7f7e95f8-d9a9-4dab-a7be-9ca274d20c2d\documentacion_funciones.md"
OUTPUT = r"C:\Users\Amaury\.gemini\antigravity\scratch\eventcontrol\Documentacion_Tecnica_EventControl.html"

with open(INPUT, "r", encoding="utf-8") as f:
    md_text = f.read()

# Remove mermaid blocks
md_text = re.sub(r'```mermaid\n.*?```', '*[Ver diagrama en el archivo Markdown original]*', md_text, flags=re.DOTALL)

html_body = markdown.markdown(md_text, extensions=['tables', 'fenced_code', 'toc'])

full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Documentación Técnica — EventControl</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    
    @page {{
        size: letter;
        margin: 2cm 2.5cm;
    }}
    
    @media print {{
        body {{ font-size: 10pt; }}
        pre {{ font-size: 8pt; page-break-inside: avoid; }}
        table {{ page-break-inside: avoid; }}
        h2 {{ page-break-before: auto; }}
        .cover {{ page-break-after: always; }}
        .no-print {{ display: none; }}
    }}
    
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    
    body {{
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 11pt;
        line-height: 1.7;
        color: #1a1a2e;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 30px;
        background: #fff;
    }}
    
    /* Cover */
    .cover {{
        text-align: center;
        padding: 120px 0 80px;
    }}
    .cover h1 {{
        font-size: 32pt;
        font-weight: 700;
        color: #1a1a2e;
        border: none;
        margin-bottom: 10px;
    }}
    .cover .subtitle {{
        font-size: 20pt;
        color: #d4af37;
        font-weight: 500;
        margin-bottom: 5px;
    }}
    .cover .desc {{
        font-size: 13pt;
        color: #666;
        font-style: italic;
        margin-bottom: 25px;
    }}
    .cover hr {{
        width: 120px;
        margin: 0 auto 25px;
        border: none;
        border-top: 3px solid #d4af37;
    }}
    .cover .tech {{
        font-size: 10pt;
        color: #888;
        margin-top: 10px;
    }}
    .cover .date {{
        font-size: 10pt;
        color: #aaa;
        margin-top: 5px;
    }}
    
    /* Print button */
    .print-btn {{
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: #d4af37;
        color: white;
        border: none;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(212,175,55,0.3);
        z-index: 100;
    }}
    .print-btn:hover {{
        background: #b8860b;
    }}
    
    h1 {{
        font-size: 20pt;
        color: #1a1a2e;
        border-bottom: 3px solid #d4af37;
        padding-bottom: 8px;
        margin-top: 35px;
        margin-bottom: 15px;
    }}
    h2 {{
        font-size: 15pt;
        color: #16213e;
        border-bottom: 2px solid #e8d5a3;
        padding-bottom: 5px;
        margin-top: 30px;
        margin-bottom: 12px;
    }}
    h3 {{
        font-size: 12pt;
        color: #0f3460;
        margin-top: 22px;
        margin-bottom: 8px;
    }}
    h4 {{
        font-size: 11pt;
        color: #333;
        margin-top: 15px;
        margin-bottom: 6px;
    }}
    
    p {{
        margin-bottom: 8px;
    }}
    
    code {{
        background: #f0f0f5;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 9.5pt;
        color: #c7254e;
    }}
    
    pre {{
        background: #1e1e2e;
        color: #cdd6f4;
        padding: 18px 20px;
        border-radius: 10px;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 9pt;
        line-height: 1.5;
        overflow-x: auto;
        margin: 12px 0;
        border-left: 4px solid #d4af37;
    }}
    pre code {{
        background: none;
        color: #cdd6f4;
        padding: 0;
        font-size: 9pt;
    }}
    
    table {{
        border-collapse: collapse;
        width: 100%;
        margin: 15px 0;
        font-size: 10pt;
    }}
    th {{
        background: #1a1a2e;
        color: white;
        padding: 10px 14px;
        text-align: left;
        font-weight: 600;
        font-size: 9.5pt;
    }}
    td {{
        padding: 8px 14px;
        border: 1px solid #e0e0e0;
    }}
    tr:nth-child(even) {{
        background: #f8f8fa;
    }}
    
    hr {{
        border: none;
        border-top: 2px solid #e8d5a3;
        margin: 30px 0;
    }}
    
    ul, ol {{
        margin: 8px 0 12px;
        padding-left: 25px;
    }}
    li {{
        margin: 4px 0;
    }}
    
    strong {{
        color: #1a1a2e;
        font-weight: 600;
    }}
    
    em {{
        color: #555;
    }}
    
    blockquote {{
        border-left: 4px solid #d4af37;
        margin: 15px 0;
        padding: 12px 18px;
        background: #fdf8f5;
        font-style: italic;
        border-radius: 0 8px 8px 0;
    }}
</style>
</head>
<body>

<!-- Portada -->
<div class="cover">
    <h1 style="border:none; font-size:32pt;">Documentación Técnica</h1>
    <div class="subtitle">EventControl</div>
    <div class="desc">Sistema de Gestión de Invitaciones — Boda A&B</div>
    <hr>
    <div class="tech">HTML5 · CSS3 · JavaScript ES6+ · Supabase · QR Scanner</div>
    <div class="date">Febrero 2026</div>
</div>

<!-- Botón de imprimir -->
<button class="print-btn no-print" onclick="window.print()">
    📄 Guardar como PDF
</button>

<!-- Contenido -->
{html_body}

</body>
</html>"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(full_html)

print(f"HTML generado: {OUTPUT}")
print(f"Abrelo en el navegador y usa Ctrl+P para guardar como PDF")
