class AdjacencyListGraph
{
private:
	vector<vector<int>> adj_list;
public:
	AdjacencyListGraph(vector<vector<int>> initial_list);
	void print();
	void add_node(vector<int> connections);
	vector<int> get_connections_from_node(int node_index);
	vector<int> get_connections_to_node(int node_index);
	void establish_connection(int nodeA, int nodeB);
	void remove_connection(int nodeA, int nodeB);
	int ajd_list_size();
};

AdjacencyListGraph::AdjacencyListGraph(vector<vector<int>> initial_list)
{
	this->adj_list = initial_list;
}

void AdjacencyListGraph::print()
{
	for (int i = 0; i < adj_list.size(); i++)
	{
		cout << i << " | ";
		for (int j = 0; j < adj_list[i].size(); j++)
		{
			cout << adj_list[i][j] << " ";
		}
		cout << endl;
	}
	system("pause");
}

void AdjacencyListGraph::add_node(vector<int> connections)
{
	adj_list.push_back(connections);
}

vector<int> AdjacencyListGraph::get_connections_from_node(int node_index)
{
	return adj_list[node_index];
}

vector<int> AdjacencyListGraph::get_connections_to_node(int node_index)
{
	vector<int> connections_to_node;
	for (int i = 0; i < adj_list.size(); i++)
	{
		vector<int> current_node_connections = get_connections_from_node(i);
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
	for (int i = 0; i < adj_list[nodeA].size(); i++)
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