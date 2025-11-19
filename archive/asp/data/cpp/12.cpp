class AdjacencyMatrixGraph
{
private:
	vector&lt;vector&lt;bool&gt;&gt; matrix;
public:
	AdjacencyMatrixGraph(vector&lt;vector&lt;bool&gt;&gt; initial_matrix);
	void print();
	vector&lt;int&gt; get_connections_from_node(int node_index);
	vector&lt;int&gt; get_connections_to_node(int node_index);
	void add_node(vector&lt;int&gt; connections);
	void establish_connection(int nodeA, int nodeB);
	void remove_connection(int nodeA, int nodeB);
	int matrix_size();
};

AdjacencyMatrixGraph::AdjacencyMatrixGraph(vector&lt;vector&lt;bool&gt;&gt; initial_matrix)
{
	this-&gt;matrix = initial_matrix;
}

void AdjacencyMatrixGraph::print()
{
	cout &lt;&lt; setfill(' ') &lt;&lt; setw(5);
	for (int i = 0; i &lt; matrix.size(); i++)
	{
		cout &lt;&lt; i &lt;&lt; " ";
	}
	cout &lt;&lt; "\n" &lt;&lt; setfill('-') &lt;&lt; setw(matrix.size() * 2 + 4);
	cout &lt;&lt; "\n";

	for (int i = 0; i &lt; matrix.size(); i++)
	{
		cout &lt;&lt; i &lt;&lt; " | ";
		for (int j = 0; j &lt; matrix[i].size(); j++)
		{
			cout &lt;&lt; matrix[i][j] &lt;&lt; " ";
		}
		cout &lt;&lt; endl;
	}
	system("pause");
}

vector&lt;int&gt; AdjacencyMatrixGraph::get_connections_from_node(int node_index)
{
	vector&lt;int&gt; result;
	for (int i = 0; i &lt; matrix[node_index].size(); i++)
	{
		if (matrix[node_index][i] == 1)
			result.push_back(matrix[node_index][i]);
	}

	return result;
}

vector&lt;int&gt; AdjacencyMatrixGraph::get_connections_to_node(int node_index)
{
	return get_connections_from_node(node_index);
}

void AdjacencyMatrixGraph::add_node(vector&lt;int&gt; connections)
{
	vector&lt;bool&gt; temp_zeros(matrix.size());
	matrix.push_back(temp_zeros);
	for (int i = 0; i &lt; matrix.size(); i++)
	{
		matrix[i].push_back(0);
	}

	int current_node = matrix.size() - 1;
	for (int i = 0; i &lt; connections.size(); i++)
	{
		establish_connection(connections[i], current_node);
	}
}

void AdjacencyMatrixGraph::establish_connection(int nodeA, int nodeB)
{
	if (matrix[nodeA][nodeB])
		matrix[nodeA][nodeB] = 1;
	if (matrix[nodeB][nodeA])
		matrix[nodeB][nodeA] = 1;
}

void AdjacencyMatrixGraph::remove_connection(int nodeA, int nodeB)
{
	if (matrix[nodeA][nodeB])
		matrix[nodeA][nodeB] = 0;
	if (matrix[nodeB][nodeA])
		matrix[nodeB][nodeA] = 0;
}

int AdjacencyMatrixGraph::matrix_size()
{
	return matrix.size();
}