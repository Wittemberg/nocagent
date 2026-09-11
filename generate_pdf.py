import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

PDF_OUTPUT = "/var/www/nocagent/MANUAL_ILUSTRADO_NOC_AGENT.pdf"
ASSETS_DIR = "/var/www/nocagent/assets/images"

MASCOT_IMG = os.path.join(ASSETS_DIR, "mascot.jpg")
NETWORK_MAP_IMG = os.path.join(ASSETS_DIR, "network_map.jpg")
BACKUP_IMG = os.path.join(ASSETS_DIR, "backup_s3.jpg")
APPROVAL_IMG = os.path.join(ASSETS_DIR, "human_approval.jpg")
VAULT_IMG = os.path.join(ASSETS_DIR, "secure_vault.jpg")

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Capa não tem cabeçalho/rodapé padrão
        
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Cabeçalho
        self.drawString(1.5 * cm, A4[1] - 1.2 * cm, "NOC-Agent • Manual Ilustrado & Guia Operacional do Sistema")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(1.5 * cm, A4[1] - 1.35 * cm, A4[0] - 1.5 * cm, A4[1] - 1.35 * cm)
        
        # Rodapé
        self.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
        self.drawString(1.5 * cm, 0.9 * cm, "Confidencial • AWE Cloud Solution • nocagent.awecloudsolution.com")
        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(A4[0] - 1.5 * cm, 0.9 * cm, page_str)
        self.restoreState()

def build_pdf():
    doc = SimpleDocTemplate(
        PDF_OUTPUT,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm
    )

    styles = getSampleStyleSheet()
    
    # Estilos de Tipografia Profissionais
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=23,
        leading=27,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
        alignment=1,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=body_style,
        leftIndent=12,
        bulletIndent=4,
        spaceAfter=3
    )

    story = []

    # ==========================================
    # PÁGINA 1: CAPA
    # ==========================================
    story.append(Spacer(1, 0.3 * cm))
    
    tag_data = [[Paragraph("<font color='#0284c7'><b>ROBÔ DE REDE & INFRAESTRUTURA 24/7 COM IA</b></font>", ParagraphStyle('Tag', alignment=1, fontSize=9, fontName='Helvetica-Bold'))]]
    tag_table = Table(tag_data, colWidths=[12 * cm])
    tag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#e0f2fe")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bae6fd")),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(tag_table)
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("MANUAL ILUSTRADO DO NOC-AGENT", title_style))
    story.append(Paragraph("Guia visual e didático: o que a ferramenta é capaz de fazer e <b>COMO</b> ela faz nos bastidores", subtitle_style))
    story.append(Spacer(1, 0.2 * cm))

    if os.path.exists(MASCOT_IMG):
        story.append(RLImage(MASCOT_IMG, width=17.5 * cm, height=9.8 * cm))
    
    story.append(Spacer(1, 0.6 * cm))
    
    cover_box = [
        [Paragraph("<b>Projeto:</b> NOC-Agent", body_style), Paragraph("<b>Versão:</b> 1.1 (Edição Visual & Backups)", body_style)],
        [Paragraph("<b>Domínio:</b> nocagent.awecloudsolution.com", body_style), Paragraph("<b>Segurança:</b> Cofre Cifrado AES-256-GCM", body_style)],
        [Paragraph("<b>Interface:</b> WhatsApp / Chatwoot / Web", body_style), Paragraph("<b>Storage:</b> Storage S3 (Backups & Snapshots)", body_style)],
        [Paragraph("<b>Motores:</b> Hermes AI Engine + Claude 3.5 / GPT-4o", body_style), Paragraph("<b>Auditoria:</b> Logs Imutáveis no PostgreSQL", body_style)],
    ]
    t_cover = Table(cover_box, colWidths=[9 * cm, 8.5 * cm])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(t_cover)
    story.append(PageBreak())

    # ==========================================
    # PÁGINA 2: O QUE É NOC & O MAPA DA SOLUÇÃO
    # ==========================================
    story.append(Paragraph("📌 O que significa NOC?", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))
    
    noc_desc_data = [
        [Paragraph(
            "<b>NOC</b> é a sigla para <b>Network Operations Center</b> (em português, <i>Centro de Operações de Rede</i>).<br/>"
            "Em provedores de internet (ISPs), data centers e operações de TI, o NOC é a 'torre de controle' responsável por "
            "<b>monitorar 24 horas por dia, 7 dias por semana</b>, toda a infraestrutura: se os links das operadoras estão no ar, "
            "se os roteadores de borda estão operando sem perda de pacotes, se os servidores estão saudáveis e se os <b>backups diários</b> "
            "foram gravados com integridade no storage S3. O <b>NOC-Agent</b> é o seu especialista de NOC virtual impulsionado por IA.",
            body_style
        )]
    ]
    t_noc = Table(noc_desc_data, colWidths=[17.5 * cm])
    t_noc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bae6fd")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_noc)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("1. O Mapa da Solução: Onde cada peça fica instalada?", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))
    
    story.append(Paragraph(
        "Você não precisa criar 10 servidores diferentes. Toda a inteligência roda em 2 containers modulares dentro da sua infraestrutura Docker atual:",
        body_style
    ))

    if os.path.exists(NETWORK_MAP_IMG):
        story.append(RLImage(NETWORK_MAP_IMG, width=17.5 * cm, height=8.4 * cm))
        story.append(Spacer(1, 0.2 * cm))

    map_table_data = [
        [Paragraph("<b>Componente</b>", body_style), Paragraph("<b>Papel no Sistema</b>", body_style), Paragraph("<b>Onde Roda</b>", body_style)],
        [Paragraph("<b>Web (Dashboard)</b>", body_style), Paragraph("Interface web moderna para visualizar gateways, backups e incidentes.", body_style), Paragraph("Container Docker (Nginx)", body_style)],
        [Paragraph("<b>Core (Hermes AI)</b>", body_style), Paragraph("Cérebro de IA: entende mensagens, consulta cofre e executa ferramentas.", body_style), Paragraph("Container Docker (Node/Python)", body_style)],
        [Paragraph("<b>Cofre Cifrado</b>", body_style), Paragraph("Guarda tokens de pfSense, Mikrotik e Proxmox com chave AES-256.", body_style), Paragraph("Tabela segura no PostgreSQL", body_style)],
        [Paragraph("<b>Storage S3</b>", body_style), Paragraph("Armazenamento seguro de backups, configs (.rsc, .xml) e snapshots.", body_style), Paragraph("Storage S3 dedicado", body_style)],
        [Paragraph("<b>Chatwoot</b>", body_style), Paragraph("Central de mensageria conectada diretamente ao WhatsApp da equipe.", body_style), Paragraph("Stack existente", body_style)],
        [Paragraph("<b>Equipamentos</b>", body_style), Paragraph("pfSense, Mikrotik, Proxmox e Zabbix consultados via APIs oficiais.", body_style), Paragraph("Sua rede física e virtual", body_style)],
    ]
    t_map = Table(map_table_data, colWidths=[3.5 * cm, 9.5 * cm, 4.5 * cm])
    t_map.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_map)
    story.append(PageBreak())

    # ==========================================
    # PÁGINA 3: CENÁRIOS A, B & C (AUDITORIA DE BACKUPS S3)
    # ==========================================
    story.append(Paragraph("2. Como Funciona na Prática: Cenários do Cotidiano", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))
    
    story.append(Paragraph("🔹 Cenário A: Consulta de Saúde no WhatsApp", h2_style))
    c1_data = [
        [Paragraph("<b>1. Pergunta do Operador:</b> <i>'Como estão os links do pfSense agora?'</i> enviada via WhatsApp.<br/>"
                   "<b>2. Análise & Cofre:</b> O Hermes identifica a intenção, resgata a API Key do pfSense no cofre cifrado.<br/>"
                   "<b>3. Execução:</b> GET em <code>/api/v2/status/gateways</code> no pfSense via REST API.<br/>"
                   "<b>4. Diagnóstico em Segundos:</b> O bot responde: <i>'GW_VIVO está online (16ms). Link WANGW está fora (100% perda)!'</i>", body_style)],
    ]
    t_c1 = Table(c1_data, colWidths=[17.5 * cm])
    t_c1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bbf7d0")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_c1)
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("🔹 Cenário B: Alerta Automático e Pré-Diagnóstico Noturno", h2_style))
    story.append(Paragraph(
        "Se um gateway cair às 03:00, o NOC-Agent não apenas acorda você com um bipe vazio. Ele testa se a porta física subiu, "
        "avalia ping no monitor IP 8.8.8.8 e dispara no grupo: <i>'Queda confirmada na operadora externa; rotas de contingência ativas'</i>.",
        body_style
    ))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("🔹 Cenário C: Análise e Alertas Proativos de Backups no Storage S3", h2_style))
    story.append(Paragraph(
        "Backups silenciosamente corrompidos ou não executados são o maior perigo de um provedor. "
        "O NOC-Agent audita ativamente a integridade dos seus backups no Storage S3:",
        body_style
    ))

    if os.path.exists(BACKUP_IMG):
        story.append(RLImage(BACKUP_IMG, width=17.5 * cm, height=8.4 * cm))
        story.append(Spacer(1, 0.2 * cm))

    box_backup = [
        [Paragraph("<b>Auditoria de Backups em 3 Etapas:</b><br/>"
                   "• <b>Validação de Execução:</b> Checa logs de rotinas no Proxmox (vzdump), backups Mikrotik (.rsc) e pfSense (.xml).<br/>"
                   "• <b>Confirmação no Storage S3:</b> Verifica se o arquivo chegou ao bucket S3 com tamanho condizente (>0 bytes).<br/>"
                   "• <b>Alerta Proativo de Atraso:</b> Se uma VM ou roteador ficar mais de 24h sem backup novo, o agente notifica:<br/>"
                   "&nbsp;&nbsp;<i>'⚠️ ALERTA: A VM 101 (srv-database) está sem backup válido há 32 horas! Última rotina falhou com erro de storage timeout.'</i>", body_style)]
    ]
    t_bk = Table(box_backup, colWidths=[17.5 * cm])
    t_bk.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fef3c7")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#fde68a")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_bk)
    story.append(PageBreak())

    # ==========================================
    # PÁGINA 4: CENÁRIO D (HUMAN APPROVAL) & COFRE DE SENHAS
    # ==========================================
    story.append(Paragraph("🔹 Cenário D: Ação Crítica com Aprovação Humana (Human-in-the-Loop)", h2_style))
    story.append(Paragraph(
        "Se um operador solicitar comandos perigosos (ex: <i>'Reiniciar VM 105 no Proxmox'</i> ou <i>'Derrubar interface do Mikrotik'</i>), "
        "o agente <b>bloqueia a execução imediata</b> e exige validação em 2 etapas:",
        body_style
    ))

    if os.path.exists(APPROVAL_IMG):
        story.append(RLImage(APPROVAL_IMG, width=17.5 * cm, height=8.0 * cm))
        story.append(Spacer(1, 0.2 * cm))

    box_approval = [
        [Paragraph("<b>Como Funciona a Trava de Segurança:</b><br/>"
                   "1. O agente gera um código de autorização único (ex: <code>APROVAR 4821</code>) válido por 5 minutos.<br/>"
                   "2. Ele resume o impacto real da ação técnica no chat do WhatsApp antes de qualquer toque no equipamento.<br/>"
                   "3. O operador confirma no WhatsApp digitando o código.<br/>"
                   "4. O comando é executado via API oficial e gravado no Audit Log (com operador, data/hora e resultado).", body_style)]
    ]
    t_app = Table(box_approval, colWidths=[17.5 * cm])
    t_app.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_app)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("3. O Cofre de Senhas: Seus Acessos 100% Blindados", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))
    
    story.append(Paragraph(
        "No NOC-Agent, <b>a IA nunca tem acesso às senhas em texto puro</b>. Toda credencial é custodiada pelo cofre criptográfico:",
        body_style
    ))

    if os.path.exists(VAULT_IMG):
        story.append(RLImage(VAULT_IMG, width=17.5 * cm, height=8.0 * cm))
        story.append(Spacer(1, 0.2 * cm))

    vault_points = [
        [Paragraph("• <b>Criptografia AES-256-GCM:</b> Senhas e tokens de equipamentos são salvos cifrados no PostgreSQL.<br/>"
                   "• <b>Descriptografia Instantânea em RAM:</b> A chave mestra descriptografa a credencial na memória apenas pelos milissegundos da chamada HTTP e a descarta em seguida.<br/>"
                   "• <b>Proteção Total contra Dumps:</b> Se o arquivo <code>.sql</code> do banco for roubado, só haverá hashes ilegíveis.<br/>"
                   "• <b>IA Cega para Senhas:</b> O Claude/GPT-4o apenas comanda: <i>'chame o driver do pfSense'</i> sem ver a chave.", body_style)]
    ]
    t_vault = Table(vault_points, colWidths=[17.5 * cm])
    t_vault.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bbf7d0")),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_vault)
    story.append(PageBreak())

    # ==========================================
    # PÁGINA 5: DASHBOARD & RESUMO DA ÓPERA
    # ==========================================
    story.append(Paragraph("4. O que tem no Dashboard Web?", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))

    dash_items = [
        [Paragraph("<b>Recurso no Painel Web</b>", body_style), Paragraph("<b>Funcionalidade</b>", body_style)],
        [Paragraph("<b>Visão Geral da Rede</b>", body_style), Paragraph("Cards em tempo real com status dos gateways (Verde = Online, Vermelho = Down, Amarelo = Perda).", body_style)],
        [Paragraph("<b>Painel de Saúde de Backups</b>", body_style), Paragraph("Indicadores visuais de rotinas concluídas, snapshots salvos no S3 e alertas de backups atrasados.", body_style)],
        [Paragraph("<b>Cofre de Equipamentos</b>", body_style), Paragraph("Cadastro seguro de roteadores, firewalls e hypervisors (senhas mascaradas como ••••••••).", body_style)],
        [Paragraph("<b>Histórico de Incidentes</b>", body_style), Paragraph("Linha do tempo de todas as quedas detectadas, tempo de indisponibilidade e resolução aplicada.", body_style)],
        [Paragraph("<b>Audit Log Imutável</b>", body_style), Paragraph("Registro auditável de cada comando executado por operadores ou pela IA, com timestamp e responsável.", body_style)],
        [Paragraph("<b>Terminal de Chat Integrado</b>", body_style), Paragraph("Converse com o NOC-Agent diretamente pelo navegador, com os mesmos recursos do WhatsApp.", body_style)],
    ]
    t_dash = Table(dash_items, colWidths=[6.0 * cm, 11.5 * cm])
    t_dash.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_dash)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("5. Resumo da Ópera: O que você ganha no dia a dia", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=6))

    summary_data = [
        [Paragraph("<font color='white'><b>Necessidade do seu Provedor / NOC</b></font>", body_style), Paragraph("<font color='white'><b>Como o NOC-Agent resolve na prática</b></font>", body_style)],
        [Paragraph("Saber a saúde da rede de qualquer lugar", body_style), Paragraph("Basta mandar áudio ou texto no WhatsApp para obter resposta imediata.", body_style)],
        [Paragraph("Ser avisado antes dos clientes reclamarem", body_style), Paragraph("Monitoramento contínuo em segundo plano com pré-diagnóstico automático.", body_style)],
        [Paragraph("Garantir que os backups estão em dia", body_style), Paragraph("Auditoria diária de snapshots no Storage S3 com alertas de falhas ou rotinas atrasadas.", body_style)],
        [Paragraph("Zero risco de comandos indevidos", body_style), Paragraph("Trava de segurança Human-in-the-Loop com confirmação de dois fatores.", body_style)],
        [Paragraph("Guardar senhas de equipamentos com segurança", body_style), Paragraph("Cofre interno com criptografia de padrão bancário/militar (AES-256-GCM).", body_style)],
        [Paragraph("Auditoria completa para conformidade", body_style), Paragraph("Cada comando executado registra autor, horário e resultado no PostgreSQL e Storage S3.", body_style)],
    ]
    t_sum = Table(summary_data, colWidths=[7.0 * cm, 10.5 * cm])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_sum)

    # Build do documento
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Novo PDF gerado com sucesso em:", PDF_OUTPUT)

if __name__ == '__main__':
    build_pdf()
