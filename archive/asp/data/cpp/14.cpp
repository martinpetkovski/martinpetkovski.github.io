#include&lt;iostream&gt;
using namespace std;

#define V 7

//функција која бара теме со минимална вредност на клучот
//во множеството темиња кои не се вклучени во MST
int minKey(int key[], bool mstSet[])
{
	int min = INT_MAX, min_index;

	for (int v = 0; v &lt; V; v++)
		if (mstSet[v] == false && key[v] &lt; min)
			min = key[v], min_index = v;

	return min_index;
}

//функција за печатење на MST
void printMST(int parent[], int n, int graph[V][V])
{
	cout &lt;&lt; "Rab    Tezhina" &lt;&lt; endl;
	for (int i = 1; i &lt; V; i++)
		cout &lt;&lt; parent[i] &lt;&lt; " - " &lt;&lt; i &lt;&lt; "     " &lt;&lt; graph[i][parent[i]] &lt;&lt; endl;
	system("pause");
}

// Конструкција и печатење на MST со матрица на соседство
void primMST(int graph[V][V])
{
	int parent[V]; // низа за чување на конструираната матрица на соседство
	int key[V];   // клучни вредонсти за минимумот
	bool mstSet[V];  // множество на теимња кои не се вклучени во MST

					 // Иницијализација на сите вредности на максималната вредност
	for (int i = 0; i &lt; V; i++)
		key[i] = INT_MAX, mstSet[i] = false;

	// Првото теме е секогаш вклучено во низата на клучеви
	key[0] = 0;     // клучот е 0 за ова теме да се земи прво
	parent[0] = -1; // првото теме е секогаш корен на MST 

					// MST-то секогаш ќе има V број на темиња
	for (int count = 0; count &lt; V - 1; count++)
	{
		// Земи го минималното теме од множеството на темиња
		// кое не е веќе вклучено во MST
		int u = minKey(key, mstSet);

		// Додај го одбраното теме во низата на MST
		mstSet[u] = true;

		// Ажурирај ја вредноста на клучот и на индексот на родителот (parent)
		// на соседните темиња на одбраното теме. Можат да се одберат само
		// оние темиња кои сè уште не се дел од MST
		for (int v = 0; v &lt; V; v++)

			// graph[u][v] не е нула само за соседни темиња
			// mstSet[v] е false за темиња кои сè уште не се вклучени во MST
			// Ажурирај го клучот само ако graph[u][v] е помало од key[v]
			if (graph[u][v] && mstSet[v] == false && graph[u][v] &lt;  key[v])
				parent[v] = u, key[v] = graph[u][v];
	}

	// испечати го конструираниот MST
	printMST(parent, V, graph);
}


int main()
{
	int graph[V][V] =
	{	//0  1  2  3  4  5  6
		{ 0, 2, 3, 3, 0, 0, 0 }, //0
		{ 2, 0, 4, 0, 4, 0, 0 }, //1
		{ 3, 4, 0, 5, 1, 6, 0 }, //2
		{ 3, 0, 5, 0, 0, 7, 0 }, //3
		{ 0, 4, 1, 0, 0, 8, 0 }, //4
		{ 0, 0, 6, 7, 8, 0, 9 }, //5
		{ 0, 0, 0, 0, 0, 9, 0 }, //6
	};

	primMST(graph);

	return 0;
}