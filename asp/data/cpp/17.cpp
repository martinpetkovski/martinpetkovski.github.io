#include &lt;iostream&gt;
using namespace std;

void max_heapify(int a[], int i, int n)
{
	int najgolem, l, r, loc;
	l = 2 * i;
	r = (2 * i + 1);
	if ((l &lt;= n) && a[l] &gt; a[i])
		najgolem = l;
	else
		najgolem = i;
	if ((r &lt;= n) && (a[r] &gt; a[najgolem]))
		najgolem = r;
	if (najgolem != i)
	{
		loc = a[i];
		a[i] = a[najgolem];
		a[najgolem] = loc;
		max_heapify(a, najgolem, n);
	}
}

void build_max_heap(int a[], int n)
{
	for (int k = n / 2; k &gt;= 1; k--)
	{
		max_heapify(a, k, n);
	}
}

void heapsort(int a[], int n)
{

	build_max_heap(a, n);
	int i, temp;
	for (i = n; i &gt;= 2; i--)
	{
		temp = a[i];
		a[i] = a[1];
		a[1] = temp;


		max_heapify(a, 1, i - 1);
	}
}

int main()
{
	int n;
	cout &lt;&lt; "Vnesi go brojot na elementi " &lt;&lt; endl;
	cin &gt;&gt; n;
	int a[n];
	cout &lt;&lt; "Vnesi gi elementite " &lt;&lt; endl;
	for (int i = 1; i &lt;= n; i++)
	{
		cin &gt;&gt; a[i];
	}
	heapsort(a, n);

	cout &lt;&lt; "Sortirana niza:" &lt;&lt; endl;
	for (int i = 1; i &lt;= n; i++)
	{
		cout &lt;&lt; a[i] &lt;&lt; endl;
	}

}
