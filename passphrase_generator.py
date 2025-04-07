import json
from pathlib import Path

class PassphraseGenerator:
    def __init__(self):
        self.leet_map = {'a': '@', 'o': '0', 'e': '3', 'i': '1', 's': '$'}
        
        self.base_passwords = [
            "password", "123456", "123456789", "qwerty", "abc123", "letmein", "monkey", "football",
            "admin", "welcome", "login", "iloveyou", "dragon", "sunshine", "princess", "passw0rd",
            "shadow", "master", "654321", "superman", "111111", "123123", "trustno1", "baseball",
            "whatever", "starwars", "computer", "harley", "batman", "jordan", "buster", "tigger",
            "soccer", "hockey", "george", "michael", "michelle", "thomas", "love", "killer", "pepper",
            "daniel", "jennifer", "jessica", "pepper", "zxcvbn", "asdfgh", "qazwsx", "1qaz2wsx"
        ]
        
        self.suffixes = ["", "1", "12", "123", "1234", "12345", "!", "2024", "#btc", "69"]
        self.phrases = set()

    def leetify(self, word):
        """Convert a word to its leet speak variant"""
        return ''.join(self.leet_map.get(c, c) for c in word)

    def generate_phrases(self, limit=10000):
        """Generate unique passphrases using various modifications"""
        for pw in self.base_passwords:
            for case in [str.lower, str.upper, str.capitalize]:
                base = case(pw)
                leet = self.leetify(base)
                for suffix in self.suffixes:
                    self.phrases.add(base + suffix)
                    self.phrases.add(leet + suffix)

        # Get first 'limit' phrases
        selected = list(self.phrases)[:limit]
        return [{
            "passphrase": phrase,
            "category": "password + leet + suffix",
            "modifiers": ["leet", "suffix", "capitalization"]
        } for phrase in selected]

    def save_phrases(self, phrases, filename="brainwallet_phrases.json"):
        """Save generated phrases to a JSON file"""
        output_path = Path(filename)
        output_path.write_text(
            json.dumps(phrases, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        return output_path.name

def main():
    generator = PassphraseGenerator()
    phrases = generator.generate_phrases(10000)
    filename = generator.save_phrases(phrases, "brainwallet_phrases_password_leet_v1.1.json")
    print(f"Generated {len(phrases)} phrases and saved to {filename}")

if __name__ == "__main__":
    main() 