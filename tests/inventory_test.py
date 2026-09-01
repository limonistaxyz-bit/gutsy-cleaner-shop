"""Exercise the actual SQL and migrations against concurrent SQLite writers."""
import concurrent.futures, pathlib, re, sqlite3, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SQL=re.search(r'const reservation=database.prepare\("([^"\n]+)"\)',(ROOT/'app/api/checkout/route.ts').read_text()).group(1)
class InventoryTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(); self.path=str(pathlib.Path(self.temp.name)/'test.db')
  self.db=sqlite3.connect(self.path)
  for path in sorted((ROOT/'drizzle').glob('*.sql')): self.db.executescript(path.read_text())
  self.db.execute("INSERT INTO batches VALUES ('batch','October 3',12,0,'2026-10-03',9999999999999,1)");self.db.commit()
 def tearDown(self):self.db.close();self.temp.cleanup()
 def reserve(self,key,count=1,now=1000):
  with sqlite3.connect(self.path,timeout=20) as c:
   return c.execute(SQL,(key,'G-'+key,'batch','Test','test@example.com','1234567890',count,2500,now+1800000,now,'{}','sandbox','batch',now,count)).rowcount
 def test_concurrent_checkouts_cannot_oversell(self):
  with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool: results=list(pool.map(lambda i:self.reserve(str(i)),range(24)))
  self.assertEqual(sum(results),12)
  self.assertEqual(self.db.execute('SELECT reserved FROM batches').fetchone()[0],12)
 def test_expiry_releases_once_and_paid_order_keeps_stock(self):
  self.reserve('a',3);self.reserve('b',4)
  self.db.execute("UPDATE orders SET status='pending_payment'");self.db.execute("UPDATE orders SET status='expired' WHERE id='a'");self.db.execute("UPDATE orders SET status='expired' WHERE id='a'");self.db.execute("UPDATE orders SET status='paid' WHERE id='b'");self.db.commit()
  self.assertEqual(self.db.execute('SELECT reserved FROM batches').fetchone()[0],4)
 def test_cutoff_closed_batch_and_oversize_are_rejected(self):
  self.assertEqual(self.reserve('a',13),0)
  self.assertEqual(self.reserve('b',1,9999999999999),0)
  self.db.execute('UPDATE batches SET is_open=0');self.db.commit()
  self.assertEqual(self.reserve('c'),0)
if __name__=='__main__':unittest.main()
