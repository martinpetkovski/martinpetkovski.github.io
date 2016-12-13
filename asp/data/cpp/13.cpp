class AdjacencyListGraph
{
private:
	vector&lt;vector&lt;int&gt;&gt; adj_list;
public:
	AdjacencyListGraph(vector&lt;vector&lt;int&gt;&gt; initial_list);
	void print();
	void add_node(vector&lt;int&gt; connections);
	vector&lt;int&gt; get_connections_from_node(int node_index);
	vector&lt;int&gt; get_connections_to_node(int node_index);
	void establish_connection(int nodeA, int nodeB);
	void remove_connection(int nodeA, int nodeB);
	int ajd_list_size();
};

AdjacencyListGraph::AdjacencyListGraph(vector&lt;vector&lt;int&gt;&gt; initial_list)
{
	this-&gt;adj_list = initial_list;
}

void AdjacencyListGraph::print()
{
	for (int i = 0; i &lt; adj_list.size(); i++)
	{
		cout &lt;&lt; i &lt;&lt; " | ";
		for (int j = 0; j &lt; adj_list[i].size(); j++)
		{
			cout &lt;&lt; adj_list[i][j] &lt;&lt; " ";
		}
		cout &lt;&lt; endl;
	}
	system("pause");
}

void AdjacencyListGraph::add_node(vector&lt;int&gt; connections)
{
	adj_list.push_back(connections);
}

vector&lt;int&gt; AdjacencyListGraph::get_connections_from_node(int node_index)
{
	return adj_list[node_index];
}

vector&lt;int&gt; AdjacencyListGraph::get_connections_to_node(int node_index)
{
	vector&lt;int&gt; connections_to_node;
	for (int i = 0; i &lt; adj_list.size(); i++)
	{
		vector&lt;int&gt; current_node_connections = get_connections_from_node(i);
		if (find(current_node_connections.begin(), current_node_connections.end(), node_index) != current_node_connections.end())
			connections_to_node.push_back(i);
	}

	return connections_to_node;
}

void AdjacencyListGraph::establish_connection(int nodeA, int nodeB)
{
	adj_list[nodeA].push_back(nodeB);
}

void AdjacencyListGraph::remove_connection(int nodeA, int nodeB)
{
	for (int i = 0; i &lt; adj_list[nodeA].size(); i++)
	{
		if (adj_list[nodeA][i] == nodeB)
		{
			swap(adj_list[nodeA][i], adj_list[nodeA][adj_list[nodeA].size() - 1]);
			adj_list[nodeA].pop_back();
		}
	}
}

int AdjacencyListGraph::ajd_list_size()
{
	return adj_list.size();
}