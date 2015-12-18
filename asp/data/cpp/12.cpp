
#include&lt;iostream&gt;
#include&lt;list&gt;
#include&lt;stack&gt;

using namespace std;

typedef unsigned int dword;
template&lt;typename T&gt;
void pechati_niza(T niza, int n)
{
	for (int i = 0; i &lt; n; i++)
		cout &lt;&lt; niza[i] &lt;&lt; " ";
}

template&lt;typename T&gt;
void pechati_kolekcija(T kolekcija)
{
	for (T::iterator it = kolekcija.begin(); it != kolekcija.end(); ++it)
		cout &lt;&lt; *it &lt;&lt; " ";
}

class Graph
{
private:
	int V;
	list&lt;int&gt; *adj;
	list&lt;int&gt; *node_queue;
public:
	Graph(int V);

	void add_edge(int v, int w);
	void BFS(int s);
	void DFS(int s);

	list&lt;int&gt; get_node_queue();
};

Graph::Graph(int V)
{
	this-&gt;V = V;
	adj = new list&lt;int&gt;[V];
	node_queue = new list&lt;int&gt;;
}

void Graph::add_edge(int v, int w)
{
	adj[v].push_back(w);
}

void Graph::BFS(int s)
{
	node_queue-&gt;resize(0);

	bool *visited = new bool[V];
	for (int i = 0; i &lt; V; i++)
		visited[i] = false;

	visited[s] = true;

	list&lt;int&gt; queue;
	queue.push_back(s);

	while (!queue.empty())
	{
		s = queue.front();
		node_queue-&gt;push_back(s);
		queue.pop_front();

		for (list&lt;int&gt;::iterator it = adj[s].begin(); it != adj[s].end(); ++it)
		{
			if (!visited[*it])
			{
				visited[*it] = true;
				queue.push_back(*it);
			}
		}
	}
}

void Graph::DFS(int s)
{
	node_queue-&gt;resize(0);

	bool *visited = new bool[V];
	for (int i = 0; i &lt; V; i++)
		visited[i] = false;

	stack&lt;int&gt; stack;

	visited[s] = true;
	stack.push(s);

	while (!stack.empty())
	{
		s = stack.top();
		node_queue-&gt;push_back(s);
		stack.pop();

		for (list&lt;int&gt;::iterator it = adj[s].begin(); it != adj[s].end(); ++it)
		{
			if (!visited[*it])
			{
				visited[*it] = true;
				stack.push(*it);
			}
		}
	}
}

list&lt;int&gt; Graph::get_node_queue()
{
	return *node_queue;
}

int main()
{
	Graph g(5);
	g.add_edge(1, 0);
	g.add_edge(0, 2);
	g.add_edge(2, 1);
	g.add_edge(0, 3);
	g.add_edge(3, 4);
	g.add_edge(4, 0);

	g.BFS(2);
	pechati_kolekcija(g.get_node_queue());
	cout &lt;&lt; endl &lt;&lt; "------------" &lt;&lt; endl;
	g.DFS(0);
	pechati_kolekcija(g.get_node_queue());

	system("pause");

	return 0;
}