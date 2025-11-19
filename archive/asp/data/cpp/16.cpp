#include&lt;iostream&gt;
using namespace std;

#define V 5

int minDistance(int dist[], bool sptSet[])
{
	int min = INT_MAX, min_index;

	for (int v = 0; v &lt; V; v++)
		if (sptSet[v] == false && dist[v] &lt;= min)
			min = dist[v], min_index = v;

	return min_index;
}

void printSolution(int dist[], int n)
{
	cout &lt;&lt; "Teme   Rastojanie od pochetno teme" &lt;&lt; endl;
	for (int i = 0; i &lt; V; i++)
		cout &lt;&lt; i &lt;&lt; "\t\t " &lt;&lt; dist[i] &lt;&lt; endl;
	system("pause");
}

void dijkstra(int graph[V][V], int src)
{
	int dist[V];     // најкраткиот пат од src до i

	bool sptSet[V]; // дали постои во SPT

					// сите растојанија на почеток се INFINITE
	for (int i = 0; i &lt; V; i++)
		dist[i] = INT_MAX, sptSet[i] = false;

	// растојанието од темето до себеси е секогаш 0
	dist[src] = 0;

	// најди најкраток пат за сите темиња
	for (int count = 0; count &lt; V - 1; count++)
	{
		// се одбира темето со најмало растојание
		int u = minDistance(dist, sptSet);

		// обележи го одбраното теме како посетено
		sptSet[u] = true;

		// Ажурирај ги растојанијата на темињата кои се соседни на одбраното теме
		for (int v = 0; v &lt; V; v++)

			// Ажурирај го dist[v] само ако не е посетено, има раб од 
			// u до v, и вкупната тежина на патот од src до v преку u е 
			// помала од моменталната вредност на dist[v]
			if (!sptSet[v] && graph[u][v] && dist[u] != INT_MAX
				&& dist[u] + graph[u][v] &lt; dist[v])
				dist[v] = dist[u] + graph[u][v];
	}

	printSolution(dist, V);
}

int main()
{
	int graph[V][V] = {
		//0  1  2  3  4  
		{ 0, 4, 2, 0, 0 },  //0
		{ 0, 0, 3, 2, 3 },  //1
		{ 0, 1, 0, 4, 5 },  //2
		{ 0, 0, 0, 0, 0 },  //3
		{ 0, 0, 0, 1, 0 },  //4
	};

	dijkstra(graph, 0);

	return 0;
}