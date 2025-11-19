#include&lt;stdio.h&gt;
#include&lt;conio.h&gt;
#include&lt;stdlib.h&gt;
#include&lt;iostream&gt;

using namespace std;

int parent[9];
int find(int);
int uni(int, int);

int main()
{
	int n, ne = 1, i, j, k, a, b, u, v;
	int min, mincost = 0, cost[9][9];


	printf("Broj na teminja:");
	scanf("%d", &n);

	printf("\nVnesi matrica na sosedstvo:\n");
	for (i = 1; i &lt;= n; i++)
	{
		for (j = 1; j &lt;= n; j++)
		{
			scanf("%d", &cost[i][j]);
			if (cost[i][j] == 0)
				cost[i][j] = 999;
		}
	}

	printf("Minuvanje so Kruskalov algoritam:\n");
	while (ne &lt; n)
	{
		for (i = 1, min = 999; i &lt;= n; i++)
		{
			for (j = 1; j &lt;= n; j++)
			{
				if (cost[i][j]&lt;min)
				{
					min = cost[i][j];
					a = u = i;
					b = v = j;

				}
			}
		}

		u = find(u);
		v = find(v);


		if (uni(u, v))
		{
			printf("\n%d edge (%d,%d) =%d\n", ne++, a, b, min);
			mincost += min;
		}
		cost[a][b] = cost[b][a] = 999;
	}
	printf("\n\tTezina na graf = %d\n", mincost);
	getch();
}

int find(int i)
{
	while (parent[i])
		i = parent[i];
	cout &lt;&lt; "parent[i]" &lt;&lt; i &lt;&lt; endl;
	return i;
}

int uni(int i, int j)
{
	if (i != j)
	{
		parent[j] = i;
		cout &lt;&lt; "parent[j] " &lt;&lt; i &lt;&lt; endl;
		return 1;
	}
	return 0;
}


