from docling.document_converter import DocumentConverter

source = "./cv2.pdf"
converter = DocumentConverter()
result = converter.convert(source) 
print(result.document.export_to_markdown())



