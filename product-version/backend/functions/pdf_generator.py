import os
os.add_dll_directory(r"C:\Program Files\GTK3-Runtime Win64\bin")
from weasyprint import HTML, CSS
from io import BytesIO
import re


FONT_PATH = os.path.join(os.path.dirname(__file__), 'fonts', 'cmunrm.ttf')
FONT_URL = f"file://{os.path.abspath(FONT_PATH)}"


def build_cover_letter_html(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> str:
    """
    Builds the HTML string for the cover letter.
    This is the SINGLE source of truth for both:
    - The in-browser editor (frontend renders this HTML inside a contentEditable div)
    - The exported PDF (WeasyPrint renders this exact HTML)
    Both will look identical.
    """

    # Build contact line from whatever fields are available
    contact_parts = [p for p in [candidate_phone, candidate_email, candidate_location] + candidate_links if p and p.strip()]
    contact_line = " &nbsp;|&nbsp; ".join(contact_parts)

    # Split cover letter into paragraphs on double newlines
    raw_paragraphs = [p.strip() for p in re.split(r'\n{2,}', cover_letter_text.strip()) if p.strip()]
    paragraphs_html = "\n".join(f'<p class="cl-paragraph">{para}</p>' for para in raw_paragraphs)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @font-face {{
    font-family: 'CMR';
    src: url('{FONT_URL}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  html, body {{
    font-family: 'CMR', 'Georgia', serif;
    font-size: 10.5pt;
    color: #1a1a1a;
    background: white;
  }}

  /* 
    .page simulates a real letter page.
    These exact dimensions and margins are used in both the editor and the PDF.
    DO NOT change these without updating the frontend container to match.
  */
  .page {{
    width: 8.5in;
    min-height: 11in;
    padding: 1in 1in 1in 1in;
    margin: 0 auto;
    background: white;
  }}

  /* Header: candidate name centered, bold */
  .header-name {{
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    letter-spacing: 0.03em;
    margin-bottom: 4pt;
  }}

  /* Contact info line: centered, lighter */
  .header-contact {{
    font-size: 9pt;
    text-align: center;
    color: #444;
    margin-bottom: 8pt;
  }}

  /* Divider line under header */
  .header-divider {{
    border: none;
    border-top: 0.75pt solid #aaa;
    margin-bottom: 20pt;
  }}

  /* Salutation */
  .salutation {{
    margin-bottom: 14pt;
    font-size: 10.5pt;
  }}

  /* Each body paragraph */
  .cl-paragraph {{
    font-size: 10.5pt;
    line-height: 1.65;
    text-align: justify;
    margin-bottom: 14pt;
    hyphens: auto;
  }}

  /* Sign-off block */
  .signoff {{
    margin-top: 20pt;
    font-size: 10.5pt;
    line-height: 1.8;
  }}
</style>
</head>
<body>
  <div class="page" id="cl-page">

    <div class="header-name">{candidate_name}</div>
    <div class="header-contact">{contact_line}</div>
    <hr class="header-divider"/>

    <div class="salutation">Dear Hiring Manager,</div>

    {paragraphs_html}

    <div class="signoff">
      Sincerely,<br/>
      {candidate_name}
    </div>

  </div>
</body>
</html>"""

    return html


def generate_cover_letter_pdf(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> bytes:
    """
    Takes cover letter text + candidate info.
    Returns raw PDF bytes ready to upload to Supabase storage.
    """

    html_string = build_cover_letter_html(
        cover_letter_text=cover_letter_text,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        candidate_location=candidate_location,
        candidate_links=candidate_links,
    )

    pdf_bytes = HTML(string=html_string, base_url=".").write_pdf()
    return pdf_bytes


def get_cover_letter_html(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> str:
    """
    Returns the raw HTML string for the frontend editor.
    The frontend renders this inside a scrollable container.
    The user edits the .cl-paragraph elements directly (contentEditable).
    On save, frontend sends back the updated innerText of #cl-page,
    which becomes the new cover_letter_text stored in user_jobs.
    """
    return build_cover_letter_html(
        cover_letter_text=cover_letter_text,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        candidate_location=candidate_location,
        candidate_links=candidate_links,
    )