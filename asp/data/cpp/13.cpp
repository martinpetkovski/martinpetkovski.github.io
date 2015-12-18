#include&lt;stdio.h&gt;
#include&lt;conio.h&gt;
#include&lt;iostream&gt;
using namespace std;

void tranzitivno(int graph[4][4])
{
	int n = 4;
	int R[n][n], i, j, k;


	for (i = 0; i &lt; n; i++)
	{
		for (j = 0; j &lt; n; j++)
		{
			R[i][j] = graph[i][j];
		}
	}
	for (k = 0; k &lt; n; k++)
	{
		for (i = 0; i &lt; n; i++)
		{
			for (j = 0; j &lt; n; j++)
			{
				R[i][j] = R[i][j] || (R[i][k] && R[k][j]);
			}
		}
	}
	cout &lt;&lt; "Tranzitivno zatvoranje so Warshall-ov:  \n";
	for (int i = 0; i &lt; n; i++)
	{
		for (int j = 0; j &lt; n; j++)
		{
			cout &lt;&lt; R[i][j];
		}
		cout &lt;&lt; endl;
	}
}
int main()
{
	int n = 4;
	int graph[4][4] = {
		{ 0, 0, 1, 0 },
		{ 1, 0, 0, 1 },
		{ 0, 0, 0, 0 },
		{ 0, 1, 0, 0 },
	};
	tranzitivno(graph);
	return 0;

}
