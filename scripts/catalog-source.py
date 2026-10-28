"""
Source of truth for the Switchback Supply demo catalog.

Run `python3 scripts/catalog-source.py` to regenerate data/catalog.json.
Edit product copy, prices, colors, and sizes here, not in the JSON.
Stock levels are generated deterministically from each SKU, so regenerating
always produces the same file. A few SKUs are deliberately low or out of stock
so the storefront (and later the AI shopping assistant) has real constraints.

Switchback Supply and every product below are fictional.
"""

import hashlib
import json
from pathlib import Path

CATEGORIES = [
    {"id": "packs", "name": "Packs", "code": "PK"},
    {"id": "footwear", "name": "Footwear", "code": "FW"},
    {"id": "outerwear", "name": "Outerwear", "code": "OW"},
    {"id": "camp", "name": "Camp", "code": "CP"},
    {"id": "lighting", "name": "Lighting", "code": "LT"},
    {"id": "water", "name": "Water", "code": "WT"},
]

SHOE_SIZES = ["8", "9", "10", "11", "12"]
APPAREL_SIZES = ["S", "M", "L", "XL"]

# Colors: (display name, hex). The FIRST color matches the product photo.
PRODUCTS = [
    # ------------------------------------------------------------------ Packs
    dict(
        id="ridgeline-45", code="RDG45", name="Ridgeline 45 Pack", category="packs", price=219,
        tagline="A framed 45 liter pack for long ridge days and quick overnights.",
        description=("The Ridgeline 45 carries a full overnight kit without feeling like an expedition pack. "
                     "An aluminum perimeter frame moves weight onto a padded hipbelt, and the floating lid "
                     "expands when you need room for food or a puffy."),
        features=["Aluminum perimeter frame with load lifters", "Padded hipbelt with zippered pockets",
                  "Floating top lid and stretch front pocket", "Hydration sleeve fits up to a 3 L reservoir"],
        specs=[("Capacity", "45 L"), ("Weight", "1.6 kg (3 lb 8 oz)"), ("Torso fit", "S 38 to 46 cm, M 43 to 51 cm, L 48 to 56 cm"),
               ("Material", "210D recycled nylon ripstop"), ("Max comfortable load", "16 kg (35 lb)")],
        tags=["backpacking", "overnight", "multi-day"],
        colors=[("Forest", "#2f5d45"), ("Slate", "#55606b")], sizes=["S", "M", "L"],
        art="pack", tone="#c9d8c5",
    ),
    dict(
        id="summit-day-22", code="SMD22", name="Summit Day 22 Daypack", category="packs", price=109,
        tagline="A light daypack with room for layers, lunch, and two liters of water.",
        description=("Built for summit pushes and long day hikes. Stretch mesh side pockets hold bottles you can "
                     "reach on the move, and a ventilated back panel keeps air moving on warm climbs."),
        features=["Ventilated mesh back panel", "Two stretch side pockets", "Trekking pole attachment loops",
                  "Lightweight removable hipbelt"],
        specs=[("Capacity", "22 L"), ("Weight", "0.7 kg (1 lb 9 oz)"), ("Fit", "One size, fits torsos 40 to 53 cm"),
               ("Material", "100D recycled nylon")],
        tags=["day hike", "lightweight", "beginner friendly"],
        colors=[("Rust", "#b5502d"), ("Charcoal", "#3a3d40")], sizes=[None],
        art="pack", tone="#ecc9b3",
    ),
    dict(
        id="basecamp-70", code="BSC70", name="Basecamp 70 Expedition Pack", category="packs", price=329,
        tagline="A 70 liter hauler for week-long trips and winter loads.",
        description=("When the trip is long or the kit is heavy, the Basecamp 70 carries it. A reinforced frame "
                     "sheet and contoured hipbelt handle loads up to 25 kg, and an adjustable torso lets you "
                     "dial in the fit at home."),
        features=["Adjustable torso length", "Ice axe loops and side compression straps",
                  "Front U-zip access to the main compartment", "Removable lid converts to a summit pack"],
        specs=[("Capacity", "70 L"), ("Weight", "2.3 kg (5 lb 1 oz)"), ("Torso fit", "M 43 to 51 cm, L 48 to 56 cm"),
               ("Material", "420D nylon with water-resistant coating"), ("Max comfortable load", "25 kg (55 lb)")],
        tags=["expedition", "multi-day", "winter"],
        colors=[("Sage Gray", "#7f8f86"), ("Ember", "#c4562a")], sizes=["M", "L"],
        art="pack", tone="#cfd4d8",
    ),
    dict(
        id="trailrunner-8", code="TRV08", name="Trailrunner 8 Vest", category="packs", price=129,
        tagline="A bounce-free running vest with two soft flasks included.",
        description=("A close-fitting vest for fast days on trail. Two 500 ml soft flasks ride up front, and the "
                     "rear compartment holds a light shell and snacks without swinging."),
        features=["Two 500 ml soft flasks included", "Adjustable sternum straps", "Phone and gel pockets within reach",
                  "Rear compartment fits a packable shell"],
        specs=[("Capacity", "8 L"), ("Weight", "0.29 kg (10 oz) without flasks"),
               ("Fit", "S chest 81 to 91 cm, M 89 to 99 cm, L 97 to 107 cm"), ("Material", "Stretch mesh and nylon")],
        tags=["trail running", "lightweight", "fast and light"],
        colors=[("Sky", "#7fb2d6"), ("Black", "#222326")], sizes=["S", "M", "L"],
        art="pack", tone="#cfe0ec",
    ),
    dict(
        id="hipline-waist", code="HPL01", name="Hipline Waist Pack", category="packs", price=49,
        tagline="Snacks, phone, and keys at your hip, with no shoulder straps.",
        description=("A waist pack for short loops, dog walks, and travel days. The wide padded belt spreads the "
                     "load, and it also wears comfortably across the body."),
        features=["Wide padded belt", "Zippered main pocket with key clip", "Wears at the waist or cross-body"],
        specs=[("Capacity", "2 L"), ("Weight", "0.15 kg (5 oz)"), ("Fit", "Belt fits 66 to 127 cm waists"),
               ("Material", "Recycled nylon")],
        tags=["day hike", "travel", "beginner friendly"],
        colors=[("Moss", "#6f7d68"), ("Charcoal", "#3a3d40")], sizes=[None],
        art="pack", tone="#d9d6cf",
    ),
    # --------------------------------------------------------------- Footwear
    dict(
        id="talus-mid", code="TLSMD", name="Talus Mid Boot", category="footwear", price=189,
        tagline="A waterproof mid hiker with a rock plate and a deep lug sole.",
        description=("The Talus Mid is a do-everything hiking boot. A waterproof membrane keeps feet dry through "
                     "stream crossings, a rock plate takes the sting out of sharp terrain, and 5 mm lugs grip on "
                     "loose descents."),
        features=["Waterproof breathable membrane", "Rock plate underfoot", "5 mm multi-directional lugs",
                  "Leather and mesh upper"],
        specs=[("Weight", "540 g (1 lb 3 oz) per boot, size 9"), ("Drop", "10 mm"), ("Waterproof", "Yes"),
               ("Fit", "True to size, medium width")],
        tags=["hiking", "waterproof", "backpacking"],
        colors=[("Brown", "#6e5a36"), ("Graphite", "#4a4d52")], sizes=SHOE_SIZES,
        art="boot", tone="#e8cfb4",
    ),
    dict(
        id="scree-runner", code="SCRRN", name="Scree Trail Runner", category="footwear", price=149,
        tagline="An aggressive trail runner for steep, loose terrain.",
        description=("Sticky rubber and deep lugs make the Scree a confident shoe on muddy switchbacks and loose "
                     "scree fields. A protective toe cap and a moderate cushion keep it comfortable past the "
                     "half marathon mark."),
        features=["Sticky rubber outsole with 6 mm lugs", "Protective toe cap", "Quick-dry mesh upper",
                  "Gaiter attachment points"],
        specs=[("Weight", "310 g (11 oz) per shoe, size 9"), ("Drop", "6 mm"), ("Waterproof", "No"),
               ("Fit", "Snug heel, roomy toe box")],
        tags=["trail running", "lightweight", "fast and light"],
        colors=[("Blaze", "#e05a2b"), ("Black", "#222326")], sizes=SHOE_SIZES,
        art="boot", tone="#f0d2c2",
    ),
    dict(
        id="fernway-low", code="FRNLW", name="Fernway Low Hiker", category="footwear", price=139,
        tagline="A cushioned low hiker that feels broken in from day one.",
        description=("For well-traveled trails and travel days, the Fernway Low pairs a soft cushioned midsole "
                     "with suede overlays that need no break-in period."),
        features=["Cushioned EVA midsole", "Suede and mesh upper", "Lugged rubber outsole"],
        specs=[("Weight", "390 g (14 oz) per shoe, size 9"), ("Drop", "10 mm"), ("Waterproof", "No"),
               ("Fit", "True to size, wide toe box")],
        tags=["hiking", "beginner friendly", "travel"],
        colors=[("Olive", "#6b7340"), ("Stone", "#a39a8a")], sizes=SHOE_SIZES,
        art="boot", tone="#dcdcc4",
    ),
    dict(
        id="riverbend-sandal", code="RVBSD", name="Riverbend Sandal", category="footwear", price=79,
        tagline="An adjustable trail sandal for river crossings and camp.",
        description=("Three adjustment points lock the Riverbend in place on wet rock, and a grippy outsole "
                     "handles short trail miles to the swimming hole."),
        features=["Three-point adjustable straps", "Quick-dry webbing", "Grippy rubber outsole"],
        specs=[("Weight", "280 g (10 oz) per sandal, size 9"), ("Waterproof", "Water friendly"),
               ("Fit", "True to size")],
        tags=["camp", "water", "travel"],
        colors=[("Black", "#222326")], sizes=SHOE_SIZES,
        art="boot", tone="#d4d4d4",
    ),
    # -------------------------------------------------------------- Outerwear
    dict(
        id="squall-shell", code="SQL3L", name="Squall 3L Shell", category="outerwear", price=279,
        tagline="A three-layer storm shell with pit zips and a helmet-ready hood.",
        description=("When weather turns above treeline, the Squall keeps wind and rain out. A durable three-layer "
                     "fabric handles abrasion from pack straps, and long pit zips dump heat on steep climbs."),
        features=["Three-layer waterproof breathable fabric", "Helmet-compatible hood", "Long pit zips",
                  "Two chest pockets that clear a hipbelt"],
        specs=[("Weight", "410 g (14.5 oz), size M"), ("Waterproof rating", "20,000 mm"), ("Fit", "Regular, room for layers"),
               ("Material", "Recycled nylon face, PFC-free water repellent")],
        tags=["waterproof", "alpine", "backpacking"],
        colors=[("Teal", "#2a7f86"), ("Black", "#222326")], sizes=APPAREL_SIZES,
        art="shell", tone="#bfd3dd",
    ),
    dict(
        id="ember-puffer", code="EMBPF", name="Ember Down Puffer", category="outerwear", price=249,
        tagline="A packable 800 fill down jacket for cold camps and summits.",
        description=("The Ember packs into its own pocket and comes out swinging when temperatures drop. Responsibly "
                     "sourced 800 fill down delivers serious warmth for its weight."),
        features=["800 fill responsibly sourced down", "Packs into its own pocket", "Insulated hood",
                  "Water-resistant shell fabric"],
        specs=[("Weight", "360 g (12.7 oz), size M"), ("Insulation", "800 fill down, 110 g"), ("Fit", "Regular"),
               ("Temperature guide", "Comfortable to about -5 C at rest with layers")],
        tags=["insulation", "winter", "packable"],
        colors=[("Amber", "#b37a35"), ("Navy", "#22344f")], sizes=APPAREL_SIZES,
        art="shell", tone="#f0cdb5",
    ),
    dict(
        id="drift-fleece", code="DRFGF", name="Drift Grid Fleece", category="outerwear", price=119,
        tagline="A breathable grid fleece quarter-zip for active warmth.",
        description=("A grid-backed fleece that traps heat when you stop and breathes when you move. The go-to "
                     "midlayer under a shell, or on its own for cool mornings."),
        features=["Grid fleece for warmth and breathability", "Quarter-zip with chin guard", "Thumb loops"],
        specs=[("Weight", "290 g (10 oz), size M"), ("Material", "Recycled polyester grid fleece"), ("Fit", "Trim")],
        tags=["midlayer", "breathable", "beginner friendly"],
        colors=[("Moss", "#6f8a62"), ("Cream", "#efe6d2")], sizes=APPAREL_SIZES,
        art="shell", tone="#ece4d2",
    ),
    dict(
        id="timberline-merino", code="TMBMR", name="Timberline Merino Base Layer", category="outerwear", price=95,
        tagline="A soft merino crew that stays fresh for days on trail.",
        description=("Merino wool regulates temperature and resists odor, so the Timberline works on day one and "
                     "day five. A flatlock seam layout prevents chafing under pack straps."),
        features=["100 percent merino wool, 200 g/m2", "Flatlock seams", "Naturally odor resistant"],
        specs=[("Weight", "210 g (7.4 oz), size M"), ("Material", "Merino wool"), ("Fit", "Next to skin")],
        tags=["base layer", "multi-day", "travel"],
        colors=[("Heather Gray", "#9a9ea3"), ("Black", "#222326")], sizes=APPAREL_SIZES,
        art="shell", tone="#dcdde0",
    ),
    # ------------------------------------------------------------------- Camp
    dict(
        id="cairn-poles", code="CRNPL", name="Cairn Expanding Carbon Poles", category="camp", price=149,
        tagline="Expanding carbon trekking poles that adjust from 100 to 135 cm.",
        description=("The Cairn poles are expanding three-section carbon poles: lengthen them for descents, shorten "
                     "them for climbs, and collapse them to 64 cm to strap on a pack. Lever locks hold firm, and "
                     "cork grips stay comfortable in sweaty hands."),
        features=["Expanding three-section design, 100 to 135 cm", "Lever locks adjust with gloves on",
                  "Cork grips with extended foam below", "Carbide tips and removable trekking baskets"],
        specs=[("Length", "Expands from 100 to 135 cm"), ("Collapsed length", "64 cm"), ("Weight", "480 g (1 lb 1 oz) per pair"),
               ("Shaft", "Carbon fiber"), ("Sold as", "Pair")],
        tags=["hiking", "backpacking", "knee support"],
        colors=[("Black", "#222326")], sizes=[None],
        art="poles", tone="#d6cde3",
    ),
    dict(
        id="bivouac-2", code="BVC02", name="Bivouac 2 Tent", category="camp", price=399,
        tagline="A freestanding two-person tent with two doors and two vestibules.",
        description=("Two doors mean nobody climbs over anyone at 2 a.m. The Bivouac 2 pitches in minutes, sheds "
                     "wind with a low profile, and packs small enough to split between two packs."),
        features=["Freestanding aluminum pole set", "Two doors and two vestibules", "Color-coded fast pitch",
                  "Mesh inner with internal pockets"],
        specs=[("Capacity", "2 people"), ("Packed weight", "1.8 kg (4 lb)"), ("Floor area", "2.7 m2"),
               ("Peak height", "102 cm"), ("Seasons", "3-season")],
        tags=["backpacking", "camp", "overnight"],
        colors=[("Fern", "#4f6b45"), ("Sand", "#c9b48f")], sizes=[None],
        art="tent", tone="#d3dcc7",
    ),
    dict(
        id="nightfall-20", code="NGT20", name="Nightfall 20 Sleeping Bag", category="camp", price=289,
        tagline="A 20 degree down mummy bag for three-season nights.",
        description=("The Nightfall 20 uses 650 fill down in a roomy mummy cut, so side sleepers can turn without "
                     "dragging the bag with them. A draft collar seals in heat on frosty nights."),
        features=["650 fill responsibly sourced down", "Draft collar and contoured hood", "Full-length two-way zipper",
                  "Stuff sack and storage sack included"],
        specs=[("Temperature rating", "20 F (-7 C) limit"), ("Weight", "1.1 kg (2 lb 7 oz), Regular"),
               ("Fits", "Regular to 183 cm, Long to 198 cm"), ("Shape", "Mummy")],
        tags=["backpacking", "camp", "overnight"],
        colors=[("Navy", "#22344f")], sizes=["Regular", "Long"],
        art="roll", tone="#c8cfdc",
    ),
    dict(
        id="loftline-pad", code="LFTPD", name="Loftline Sleeping Pad", category="camp", price=159,
        tagline="An insulated air pad that packs to the size of a water bottle.",
        description=("Reflective layers inside the Loftline trap body heat for shoulder-season nights, and 8 cm of "
                     "air keeps hips off the ground. A one-way valve makes inflating and deflating quick."),
        features=["8 cm thick", "Reflective insulation layers", "One-way inflation valve", "Pump sack included"],
        specs=[("R-value", "4.2"), ("Weight", "450 g (1 lb), Regular"), ("Thickness", "8 cm"),
               ("Sizes", "Regular 183 x 51 cm, Long 196 x 64 cm, Wide Long 196 x 76 cm")],
        tags=["backpacking", "camp", "overnight"],
        colors=[("Ochre", "#c58a3a")], sizes=["Regular", "Long", "Wide Long"],
        art="roll", tone="#f2d4bf",
    ),
    dict(
        id="kindle-stove", code="KNDST", name="Kindle Canister Stove", category="camp", price=69,
        tagline="A tiny titanium stove that boils a liter in about three minutes.",
        description=("The Kindle screws onto standard isobutane canisters and folds into a titanium pot. A wide "
                     "burner head spreads the flame so you can simmer, not just boil."),
        features=["Titanium build", "Fits standard threaded canisters", "Folding pot supports", "Simmer control"],
        specs=[("Weight", "75 g (2.6 oz)"), ("Boil time", "About 3 minutes per liter"), ("Fuel", "Isobutane canister, sold separately")],
        tags=["camp", "cooking", "lightweight"],
        colors=[("Titanium", "#9ea3a8")], sizes=[None],
        art="stove", tone="#dedfe0",
    ),
    dict(
        id="perch-chair", code="PRCCH", name="Perch Camp Chair", category="camp", price=129,
        tagline="An ultralight chair that sets up in under a minute.",
        description=("Real back support at camp for under a kilogram. Shock-corded poles snap together, and the "
                     "chair packs down to the size of a water bottle."),
        features=["Shock-corded aluminum frame", "Breathable mesh panels", "Packs into an attached stuff sack"],
        specs=[("Weight", "0.95 kg (2 lb 1 oz)"), ("Seat height", "33 cm"), ("Capacity", "120 kg (265 lb)")],
        tags=["camp", "car camping", "lightweight"],
        colors=[("Sage", "#8a978c"), ("Gray", "#7d8288")], sizes=[None],
        art="chair", tone="#d8d9d3",
    ),
    # --------------------------------------------------------------- Lighting
    dict(
        id="alpenglow-400", code="ALP40", name="Alpenglow 400 Headlamp", category="lighting", price=54,
        tagline="A 400 lumen rechargeable headlamp with a red night mode.",
        description=("Bright enough for pre-dawn summit starts, gentle enough for the tent. The Alpenglow charges "
                     "over USB-C and remembers your last brightness setting."),
        features=["400 lumen max output", "Red night mode", "USB-C rechargeable", "Lock mode to prevent accidental on"],
        specs=[("Max output", "400 lumens"), ("Beam distance", "90 m"), ("Run time", "4 h high, 60 h low"),
               ("Weight", "68 g (2.4 oz)"), ("Water resistance", "IPX4")],
        tags=["lighting", "camp", "backpacking"],
        colors=[("Summit Yellow", "#e2b93b"), ("Black", "#222326")], sizes=[None],
        art="headlamp", tone="#efe0a8",
    ),
    dict(
        id="firefly-lantern", code="FRFLN", name="Firefly Collapsible Lantern", category="lighting", price=39,
        tagline="A collapsible lantern that casts a warm glow across camp.",
        description=("The Firefly collapses flat to pack and pops up to light the whole tent. A warm white LED and "
                     "a hanging loop make it the coziest thing in your kit."),
        features=["Collapses to 3 cm tall", "Warm white dimmable LED", "Hanging loop", "USB-C rechargeable"],
        specs=[("Max output", "150 lumens"), ("Run time", "10 h high, 50 h low"), ("Weight", "110 g (3.9 oz)")],
        tags=["lighting", "camp", "car camping"],
        colors=[("Sage", "#8a9a6e"), ("Smoke", "#bfc3c4")], sizes=[None],
        art="lantern", tone="#f3e7c4",
    ),
    dict(
        id="waypoint-mini", code="WYPMN", name="Waypoint Mini Flashlight", category="lighting", price=34,
        tagline="A pocket flashlight for the glovebox, the pack, and the power outage.",
        description=("A rugged aluminum flashlight small enough to live on your keys. Tail switch operation and a "
                     "pocket clip make it easy to grab in the dark."),
        features=["Anodized aluminum body", "Pocket clip", "Tail switch", "USB-C rechargeable"],
        specs=[("Max output", "300 lumens"), ("Run time", "2 h high, 20 h low"), ("Weight", "45 g (1.6 oz)"),
               ("Water resistance", "IPX7")],
        tags=["lighting", "everyday carry", "travel"],
        colors=[("Forest", "#2f5d45"), ("Black", "#222326")], sizes=[None],
        art="headlamp", tone="#d4dccf",
    ),
    # ------------------------------------------------------------------ Water
    dict(
        id="spring-filter", code="SPRFL", name="Springline Filter", category="water", price=42,
        tagline="A squeeze filter rated to 0.1 micron for clean water anywhere.",
        description=("Fill the pouch, screw on the Springline, and squeeze clean water into your bottle. It also "
                     "threads onto most standard bottles for drinking straight through."),
        features=["0.1 micron hollow fiber filter", "Collapsible 1 L pouch included", "Fits standard bottle threads",
                  "Backflush syringe included"],
        specs=[("Filter rating", "0.1 micron"), ("Flow rate", "About 1.5 L per minute"), ("Weight", "85 g (3 oz)"),
               ("Removes", "Bacteria and protozoa")],
        tags=["water", "backpacking", "lightweight"],
        colors=[("Blue", "#3d7fb5")], sizes=[None],
        art="filter", tone="#c4dfd8",
    ),
    dict(
        id="headwater-2l", code="HDW2L", name="Headwater 2L Reservoir", category="water", price=36,
        tagline="A 2 liter hydration reservoir with a wide opening for easy cleaning.",
        description=("Sip on the move without stopping to dig out a bottle. A wide slide-top opening makes the "
                     "Headwater easy to fill with ice and easy to dry out after a trip."),
        features=["Wide slide-top opening", "Bite valve with on and off switch", "Quick-disconnect hose",
                  "Taste-free, BPA-free film"],
        specs=[("Capacity", "2 L"), ("Weight", "180 g (6.3 oz)"), ("Fits", "Most packs with a hydration sleeve")],
        tags=["water", "hiking", "trail running"],
        colors=[("Sage", "#8fa88a")], sizes=[None],
        art="bottle", tone="#d6e6ee",
    ),
    dict(
        id="canyon-bottle", code="CNY32", name="Canyon 32 oz Insulated Bottle", category="water", price=38,
        tagline="Cold for 24 hours, hot for 12, and tough enough for the trunk.",
        description=("Double-wall vacuum insulation keeps drinks cold through a desert afternoon. A powder-coated "
                     "finish grips in wet hands, and the loop cap clips onto a pack."),
        features=["Double-wall vacuum insulation", "Powder-coated grip finish", "Leakproof loop cap"],
        specs=[("Capacity", "32 oz (946 ml)"), ("Keeps cold", "24 hours"), ("Keeps hot", "12 hours"),
               ("Weight", "450 g (15.9 oz)")],
        tags=["water", "car camping", "everyday carry"],
        colors=[("Sage", "#9cb08f"), ("Slate", "#55606b"), ("Blaze", "#e05a2b")], sizes=[None],
        art="bottle", tone="#d8e2d2",
    ),
]


def stock_for(sku: str) -> int:
    """Deterministic stock: about 8 percent sold out, 16 percent low (1 to 3), the rest 6 to 40."""
    n = int(hashlib.sha256(sku.encode()).hexdigest()[:8], 16)
    bucket = n % 100
    if bucket < 8:
        return 0
    if bucket < 24:
        return 1 + (n // 100) % 3
    return 6 + (n // 100) % 35


COLOR_CODES = {"Black": "BLK", "Blaze": "BLZ", "Blue": "BLU"}


def color_code(name: str) -> str:
    return COLOR_CODES.get(name) or "".join(ch for ch in name.upper() if ch.isalpha())[:3]


def size_code(size: str) -> str:
    return {"Regular": "REG", "Long": "LNG", "Wide Long": "WLG"}.get(size, size.upper())


def build():
    cats = {c["id"]: c for c in CATEGORIES}
    out_products = []
    for p in PRODUCTS:
        cat = cats[p["category"]]
        variants = []
        for color_name, hexval in p["colors"]:
            for size in p["sizes"]:
                parts = ["SB", cat["code"], p["code"], color_code(color_name)]
                if size:
                    parts.append(size_code(size))
                sku = "-".join(parts)
                variants.append({"sku": sku, "color": color_name, "colorHex": hexval, "size": size,
                                 "stock": stock_for(sku)})
        out_products.append({
            "id": p["id"], "name": p["name"], "category": p["category"], "price": p["price"],
            "tagline": p["tagline"], "description": p["description"], "features": p["features"],
            "specs": [{"label": k, "value": v} for k, v in p["specs"]], "tags": p["tags"],
            "art": p["art"], "tone": p["tone"], "image": None, "variants": variants,
        })
    catalog = {
        "store": "Switchback Supply",
        "currency": "USD",
        "note": "Fictional demo catalog. Generated by scripts/catalog-source.py; edit that file, not this one.",
        "categories": [{"id": c["id"], "name": c["name"]} for c in CATEGORIES],
        "products": out_products,
    }
    root = Path(__file__).resolve().parent.parent
    # A product gets a photo when web/public/products/<id>.webp exists; otherwise it shows its illustration.
    for p in catalog["products"]:
        if (root / "web" / "public" / "products" / f"{p['id']}.webp").exists():
            p["image"] = f"/products/{p['id']}.webp"
    target = root / "data" / "catalog.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(catalog, indent=2) + "\n")
    skus = sum(len(p["variants"]) for p in out_products)
    print(f"Wrote {target.relative_to(root)}: {len(out_products)} products, {skus} SKUs")


if __name__ == "__main__":
    build()
