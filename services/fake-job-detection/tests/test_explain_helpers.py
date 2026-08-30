import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from explain import _as_1d_fake_values, _to_highlights, merge_subword_attributions


class MergeSubwordTests(unittest.TestCase):
    def test_sentencepiece_pieces_sum_into_words(self):
        tokens = ["<s>", "▁pay", "ment", "▁fee", "▁the", "▁Whats", "App", "</s>"]
        values = [0.0, 0.20, 0.10, 0.40, -0.05, 0.12, 0.08, 0.0]
        pairs = dict(merge_subword_attributions(tokens, values))
        self.assertAlmostEqual(pairs["payment"], 0.30)
        self.assertAlmostEqual(pairs["fee"], 0.40)
        self.assertAlmostEqual(pairs["WhatsApp"], 0.20)
        self.assertNotIn("the", pairs)

    def test_regex_masker_tokens_stay_separate_words(self):
        tokens = ["Pay ", "a ", "registration ", "fee ", "via ", "WhatsApp ", "to ", "apply ", "now"]
        values = [0.1, 0.0, 0.4, 0.3, 0.05, 0.2, 0.0, 0.15, 0.11]
        pairs = dict(merge_subword_attributions(tokens, values))
        self.assertAlmostEqual(pairs["Pay"], 0.1)
        self.assertAlmostEqual(pairs["registration"], 0.4)
        self.assertAlmostEqual(pairs["fee"], 0.3)
        self.assertAlmostEqual(pairs["WhatsApp"], 0.2)
        self.assertAlmostEqual(pairs["apply"], 0.15)
        self.assertAlmostEqual(pairs["now"], 0.11)
        self.assertNotIn("applynow", pairs)
        self.assertNotIn("registrationfeeviaWhatsApp", pairs)

    def test_highlights_use_fake_class_sign(self):
        highlights = _to_highlights([("fee", 0.4), ("EPF", -0.2)])
        by_token = {item["token"]: item for item in highlights}
        self.assertEqual(by_token["fee"]["toward"], "fake")
        self.assertEqual(by_token["EPF"]["toward"], "legitimate")


class ShapValueShapeTests(unittest.TestCase):
    def test_picks_fake_class_column(self):
        values = [[0.1, 0.4], [0.2, -0.3]]
        fake = _as_1d_fake_values(values)
        self.assertEqual(list(fake), [0.4, -0.3])


if __name__ == "__main__":
    unittest.main()
