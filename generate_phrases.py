import json
from pathlib import Path

leet_map = {'a': '@', 'o': '0', 'e': '3', 'i': '1', 's': '$'}

def leetify(word):
    return ''.join(leet_map.get(c, c) for c in word)

base_passwords = [
    "password", "123456", "123456789", "qwerty", "abc123", "letmein", "monkey", "football",
    "admin", "welcome", "login", "iloveyou", "dragon", "sunshine", "princess", "passw0rd",
    "shadow", "master", "654321", "superman", "111111", "123123", "trustno1", "baseball",
    "whatever", "starwars", "computer", "harley", "batman", "jordan", "buster", "tigger",
    "soccer", "hockey", "george", "michael", "michelle", "thomas", "love", "killer", "pepper",
    "daniel", "jennifer", "jessica", "pepper", "zxcvbn", "asdfgh", "qazwsx", "1qaz2wsx"
]

suffixes = ["", "1", "12", "123", "1234", "12345", "!", "2024", "#btc", "69"]

phrases = set()

# Используем прямой product для эффективной генерации
for pw in base_passwords:
    for case in [str.lower, str.upper, str.capitalize]:
        base = case(pw)
        leet = leetify(base)
        for suffix in suffixes:
            phrases.add(base + suffix)
            phrases.add(leet + suffix)

# Отбираем первые 10 000
selected = list(phrases)[:10000]
final = [{
    "passphrase": phrase,
    "category": "password + leet + suffix",
    "modifiers": ["leet", "suffix", "capitalization"]
} for phrase in selected]

# Сохраняем
output_path = Path("brainwallet_phrases_password_leet_v1.1.json")
output_path.write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Generated {len(selected)} phrases and saved to {output_path.name}") 