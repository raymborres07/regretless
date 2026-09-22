from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/regretless-3-minute-pitch.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold')
ink=HexColor('#1d2320'); lime=HexColor('#d8f36c'); muted=HexColor('#5f6a61')
SITE='https://third-clam-324.convex.site'
c=canvas.Canvas(str(OUT),pagesize=(612,792))
c.setTitle('Regretless - Three-minute pitch and click guide')
c.setAuthor('Regretless')

def para(text,x,y,w=516,size=12,color=ink,font='Arial',leading=None):
    p=Paragraph(text,ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.42,textColor=color))
    _,h=p.wrap(w,700);p.drawOn(c,x,y-h);return y-h

def page(n,title,sub):
    c.setFillColor(HexColor('#f7f7f4'));c.rect(0,0,612,792,fill=1,stroke=0)
    para('regretless',48,752,size=24,font='ArialBold')
    para('3-MINUTE PITCH  |  PRESENTER COPY',330,746,w=234,size=9,color=muted)
    c.setStrokeColor(HexColor('#dfe3da'));c.line(48,704,564,704)
    para(title,48,680,size=24,font='ArialBold')
    para(sub,48,640,size=11,color=muted)
    para('LIVE SITE  |  REAL TARGET PRODUCTS + POLICY  |  SAMPLE PRICE PAID  |  NO EMAIL SENT',48,38,size=8,color=muted)
    para(f'{n} / 3',523,38,w=45,size=9,color=muted)

def block(y,time,title,click,say):
    c.setFillColor(lime);c.roundRect(48,y-27,96,27,6,fill=1,stroke=0)
    para(time,57,y-6,w=86,size=11,font='ArialBold')
    para(title,158,y-4,w=406,size=15.5,font='ArialBold')
    y-=40
    y=para('<b>CLICK</b>  '+click,48,y,size=10.5,color=muted)-9
    y=para('<b>SAY</b>  '+say,48,y,size=12,leading=17)-20
    return y

# Page 1
page(1,'Hook: money people leave behind.','0:00-0:50  |  Home page. Speak slowly. Let the product carry it.')
y=para(f'<b>Before recording:</b> open a <b>new private/incognito window</b> at <link href="{SITE}" color="#1f5c3a">{SITE.replace("https://","")}</link> '
       '(a new window = fresh sample orders). Desktop, browser zoom 100%, notifications off. Wait until four product photos load. '
       'Rehearse once: the live check in step 4 takes about 30-60 seconds. You can talk over it or cut the wait when editing.',48,600,size=10.5)-22
y=block(y,'0:00-0:20','The problem',
 'Nothing yet. Keep the cursor still on the headline.',
 'You buy headphones. A week later, the price drops a hundred dollars. Stores like Target will actually refund the difference, within 14 days, but almost nobody asks. Regretless asks for you.')
y=block(y,'0:20-0:50','Real products, live prices',
 'Point at the green <b>$100.00</b> summary, then the <b>Sony WH-1000XM5</b> card (You paid $399.99, Today $299.99). Point at the <b>Sample</b> tag and the banner.',
 'These are real Target products with real product pages. Only the price paid is a sample. Every few hours, Firecrawl pulls the live price and photo from Target, and Convex pushes changes to everyone\u2019s screen instantly. Right now, these Sony headphones are a hundred dollars cheaper than what we paid.')
para('<b>Tip:</b> if Target changed the price since today, say the numbers you see. They are live, which is the point.',48,y,size=10,color=muted)
c.showPage()

# Page 2
page(2,'The live check.','0:50-2:05  |  One click runs Firecrawl + OpenAI + Convex for real.')
y=block(596,'0:50-1:05','Open the purchase',
 'Click the <b>Sony WH-1000XM5</b> card. Point at <b>You paid / Target today / Difference</b> and the 5-step tracker.',
 'Open it and you see exactly where you stand: what you paid, what Target charges today, and the difference. Five simple steps from price drop to money back.')
y=block(y,'1:05-1:45','Check if I qualify (live)',
 'Click <b>Check if I qualify</b>. Do not click again. Watch the tracker spin; stay on this dialog.',
 'One click. Firecrawl re-reads the live Target page and Target\u2019s price-match policy. OpenAI reads that policy against my purchase date, the 14-day window and the exclusions. And every quote it uses has to appear word for word on Target\u2019s page, or we throw it out. No invented promises. Each step streams in live through Convex.')
y=block(y,'1:45-2:05','The money moment',
 'When it shows <b>Ready to claim</b> and <b>You can likely get $100.00 back</b>, pause 2 seconds. Scroll down a little to the green <b>The store policy covers this</b> box and the quotes.',
 'There it is: likely a hundred dollars back, with Target\u2019s own words as the evidence, including the fourteen-day price-match rule.')
para('<b>If it says \u201cNot a clear yes\u201d:</b> the AI was cautious. Click <b>Check price &amp; policy now</b> once more. '
     '<b>If it says \u201cCouldn\u2019t check\u201d:</b> Target blocked that one retrieval; wait 30 seconds and retry. Record a second take rather than explaining.',48,y,size=10,color=muted)
c.showPage()

# Page 3
page(3,'Control, then the close.','2:05-3:00  |  Show the drafted request, adding a purchase, and end.')
y=block(596,'2:05-2:30','The request writes itself',
 'Scroll down to <b>Your request to Target</b>. Show the subject and the message OpenAI drafted. Point at the note that samples are never emailed.',
 'OpenAI drafts a polite, specific request with the order, dates, prices and the policy. You review everything. Nothing is sent without your approval, and sample orders are never emailed to a real store.')
y=block(y,'2:30-2:45','Add your own purchase',
 'Click <b>X</b> (top right of the dialog), then <b>Add a purchase</b>. Point at the three options. Click <b>X</b> to close without saving.',
 'For your own orders: paste the confirmation email and OpenAI fills in the details, forward receipts to your own inbox, or type it in. It takes about a minute.')
y=block(y,'2:45-3:00','Close',
 'Stay on the home page. Stop recording after the last line.',
 'Regretless: prices drop after you buy, and now you get the difference back. Built on Convex, with OpenAI, Firecrawl and AgentMail.')
para('<b>Honesty notes (do not say otherwise on camera):</b> the price paid and order numbers are samples; products, prices and Target\u2019s policy are real and live. '
     'Only claim that AgentMail <i>sends</i> email if you have added AGENTMAIL_API_KEY in the Convex dashboard and tested it. Until then, say \u201cthe send step is built on AgentMail.\u201d '
     'The AI reading is guidance; Target makes the final call.',48,y,size=10,color=muted)
c.save()

reader=PdfReader(str(OUT))
assert len(reader.pages)==3
assert all(len(p.extract_text())>500 for p in reader.pages)
print(f'Created {OUT} | pages: {len(reader.pages)}')
