

#include<iostream>
#include<list>
#include<stack>

using namespace std;

typedef unsigned int dword;
template<typename T>
void pechati_niza(T niza, int n)
{
	for (int i = 0; i < n; i++)
		cout << niza[i] << " ";
}

template<typename T>
void pechati_kolekcija(T kolekcija)
{
	for (T::iterator it = kolekcija.begin(); it != kolekcija.end(); ++it)
		cout << *it << " ";
}

class Graph
{
private:
	int V;
	list<int> *adj;
	list<int> *node_queue;
public:
	Graph(int V);

	void add_edge(int v, int w);
	void BFS(int s);
	void DFS(int s);

	list<int> get_node_queue();
};

Graph::Graph(int V)
{
	this->V = V;
	adj = new list<int>[V];
	node_queue = new list<int>;
}

void Graph::add_edge(int v, int w)
{
	adj[v].push_back(w);
}

void Graph::BFS(int s)
{
	node_queue->resize(0);

	bool *visited = new bool[V];
	for (int i = 0; i < V; i++)
		visited[i] = false;

	visited[s] = true;

	list<int> queue;
	queue.push_back(s);

	while (!queue.empty())
	{
		s = queue.front();
		node_queue->push_back(s);
		queue.pop_front();

		for (list<int>::iterator it = adj[s].begin(); it != adj[s].end(); ++it)
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
	node_queue->resize(0);

	bool *visited = new bool[V];
	for (int i = 0; i < V; i++)
		visited[i] = false;

	stack<int> stack;

	visited[s] = true;
	stack.push(s);

	while (!stack.empty())
	{
		s = stack.top();
		node_queue->push_back(s);
		stack.pop();

		for (list<int>::iterator it = adj[s].begin(); it != adj[s].end(); ++it)
		{
			if (!visited[*it])
			{
				visited[*it] = true;
				stack.push(*it);
			}
		}
	}
}

list<int> Graph::get_node_queue()
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
	cout << endl << "------------" << endl;
	g.DFS(0);
	pechati_kolekcija(g.get_node_queue());

	system("pause");

	return 0;
}