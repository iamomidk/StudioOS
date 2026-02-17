import unittest

from app.main import health


class HealthTests(unittest.TestCase):
    def test_health_returns_ok(self) -> None:
        self.assertEqual(health(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
